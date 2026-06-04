/// nexus_marketplace.move — Core Marketplace Contract
///
/// Implements a decentralized marketplace for AI training datasets stored on Walrus.
/// Data providers upload datasets to Walrus and list them for sale in SUI.
/// AI agents can autonomously discover, evaluate, and purchase datasets.
///
/// Key objects:
/// - Marketplace: Shared object that holds all listings and treasury
/// - DatasetListing: Shared object representing a dataset for sale
/// - DatasetAccess: Owned object proving purchase (required to download)
///
/// Economic model:
/// - Prices in MIST (1 SUI = 1,000,000,000 MIST)
/// - 2% platform fee on sales → NexusTreasury
/// - 98% → dataset provider
module nexus::nexus_marketplace {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use std::vector;

    // === Errors ===

    const ENotOwner: u64 = 0;
    const EInsufficientPayment: u64 = 1;
    const EAlreadyPurchased: u64 = 2;
    const EListingNotFound: u64 = 3;
    const EListingNotActive: u64 = 4;
    const EInvalidPrice: u64 = 5;
    const EInvalidEpochs: u64 = 6;
    const EEmptyName: u64 = 7;
    const EEmptyDescription: u64 = 8;
    const EEmptyWalrusBlobId: u64 = 9;
    const EAlreadyHasAccess: u64 = 10;

    // === Constants ===

    /// Platform fee: 2% (200 basis points)
    const PLATFORM_FEE_BPS: u64 = 200;
    const BASIS_POINTS_DENOMINATOR: u64 = 10000;

    // === Structs ===

    /// Shared object: The marketplace itself
    /// Holds all listings, treasury balance, and configuration
    public struct Marketplace has key {
        id: UID,
        /// All active listings, keyed by listing ID
        listings: Table<ID, DatasetListing>,
        /// Treasury balance (platform fees accumulate here)
        treasury: Balance<SUI>,
        /// Platform fee in basis points (default 200 = 2%)
        fee_bps: u64,
        /// Admin address (can update fees, pause marketplace)
        admin: address,
        /// Whether the marketplace is paused
        paused: bool,
        /// Total number of listings created
        total_listings: u64,
        /// Total number of sales
        total_sales: u64,
        /// Total volume in MIST
        total_volume: u64,
    }

    /// Shared object: A dataset listing
    /// Created by data providers when they list a dataset
    public struct DatasetListing has key, store {
        id: UID,
        /// Name of the dataset
        name: String,
        /// Description of the dataset
        description: String,
        /// Category (e.g., "embeddings", "fine-tuning", "model-weights")
        category: String,
        /// Walrus blob ID where the dataset is stored
        walrus_blob_id: String,
        /// Size of the dataset in bytes
        size_bytes: u64,
        /// Price in MIST
        price: u64,
        /// Address of the data provider
        provider: address,
        /// Whether the listing is active
        active: bool,
        /// Timestamp when listed
        listed_at: u64,
        /// Number of purchases
        purchase_count: u64,
        /// Optional: SHA256 hash for integrity verification
        content_hash: Option<String>,
        /// Optional: Number of epochs the Walrus blob is stored for
        storage_epochs: Option<u64>,
    }

    /// Owned object: Proves purchase and grants download access
    /// Transferred to buyer after successful purchase
    public struct DatasetAccess has key, store {
        id: UID,
        /// The listing this access is for
        listing_id: ID,
        /// The Walrus blob ID (copy from listing for convenience)
        walrus_blob_id: String,
        /// Address of the buyer
        owner: address,
        /// Timestamp of purchase
        purchased_at: u64,
        /// Optional: Content hash for verification
        content_hash: Option<String>,
    }

    /// Owned object: Capability that proves ownership of a listing
    /// Given to provider when they create a listing
    public struct ProviderCap has key, store {
        id: UID,
        /// The listing this capability controls
        listing_id: ID,
    }

    // === Events ===

    /// Emitted when a new dataset is listed
    public struct DatasetListed has copy, drop {
        listing_id: ID,
        name: String,
        category: String,
        walrus_blob_id: String,
        size_bytes: u64,
        price: u64,
        provider: address,
        timestamp: u64,
    }

    /// Emitted when a dataset is purchased
    public struct DatasetPurchased has copy, drop {
        listing_id: ID,
        buyer: address,
        price: u64,
        platform_fee: u64,
        provider_payout: u64,
        timestamp: u64,
    }

    /// Emitted when a listing is delisted
    public struct DatasetDelisted has copy, drop {
        listing_id: ID,
        provider: address,
        timestamp: u64,
    }

    // === Init ===

    /// Called once when the module is published
    /// Creates the shared Marketplace object
    fun init(ctx: &mut TxContext) {
        let marketplace = Marketplace {
            id: object::new(ctx),
            listings: table::new(ctx),
            treasury: balance::zero(),
            fee_bps: PLATFORM_FEE_BPS,
            admin: tx_context::sender(ctx),
            paused: false,
            total_listings: 0,
            total_sales: 0,
            total_volume: 0,
        };
        transfer::share_object(marketplace);
    }

    // === Public Functions ===

    /// List a new dataset on the marketplace
    ///
    /// Creates a DatasetListing (shared) and ProviderCap (owned by caller).
    /// The provider must have already uploaded the dataset to Walrus.
    ///
    /// Arguments:
    /// - marketplace: The shared Marketplace object
    /// - name: Name of the dataset (must be non-empty)
    /// - description: Description (must be non-empty)
    /// - category: Category string (e.g., "embeddings")
    /// - walrus_blob_id: The Walrus blob ID (must be non-empty)
    /// - size_bytes: Size of the dataset in bytes
    /// - price: Price in MIST (must be > 0)
    /// - content_hash: Optional SHA256 hash for integrity
    /// - storage_epochs: Optional number of Walrus storage epochs
    /// - clock: The Sui clock object for timestamps
    /// - ctx: Transaction context
    public fun list_dataset(
        marketplace: &mut Marketplace,
        name: String,
        description: String,
        category: String,
        walrus_blob_id: String,
        size_bytes: u64,
        price: u64,
        content_hash: Option<String>,
        storage_epochs: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext,
    ): ID {
        // Validate inputs
        assert!(!marketplace.paused, EListingNotActive);
        assert!(string::length(&name) > 0, EEmptyName);
        assert!(string::length(&description) > 0, EEmptyDescription);
        assert!(string::length(&walrus_blob_id) > 0, EEmptyWalrusBlobId);
        assert!(price > 0, EInvalidPrice);

        let provider = tx_context::sender(ctx);
        let timestamp = sui::clock::timestamp_ms(clock);

        // Create the listing
        let listing = DatasetListing {
            id: object::new(ctx),
            name,
            description,
            category,
            walrus_blob_id,
            size_bytes,
            price,
            provider,
            active: true,
            listed_at: timestamp,
            purchase_count: 0,
            content_hash,
            storage_epochs,
        };

        let listing_id = object::id(&listing);

        // Create provider capability
        let cap = ProviderCap {
            id: object::new(ctx),
            listing_id,
        };

        // Add listing to marketplace
        table::add(&mut marketplace.listings, listing_id, listing);
        marketplace.total_listings = marketplace.total_listings + 1;

        // Emit event
        event::emit(DatasetListed {
            listing_id,
            name,
            category,
            walrus_blob_id,
            size_bytes,
            price,
            provider,
            timestamp,
        });

        // Transfer capability to provider
        transfer::transfer(cap, provider);

        listing_id
    }

    /// Purchase a dataset
    ///
    /// Pays the provider (minus platform fee) and transfers DatasetAccess to buyer.
    ///
    /// Arguments:
    /// - marketplace: The shared Marketplace object
    /// - listing_id: ID of the listing to purchase
    /// - payment: Coin<SUI> payment (must be >= price)
    /// - clock: The Sui clock object for timestamps
    /// - ctx: Transaction context
    public fun buy_dataset(
        marketplace: &mut Marketplace,
        listing_id: ID,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!marketplace.paused, EListingNotActive);
        assert!(table::contains(&marketplace.listings, listing_id), EListingNotFound);

        let listing = table::borrow_mut(&mut marketplace.listings, listing_id);
        assert!(listing.active, EListingNotActive);

        let buyer = tx_context::sender(ctx);
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= listing.price, EInsufficientPayment);

        // Calculate fees
        let platform_fee = (listing.price * marketplace.fee_bps) / BASIS_POINTS_DENOMINATOR;
        let provider_payout = listing.price - platform_fee;

        // Split payment: fee to treasury, rest to provider
        let mut payment_balance = coin::into_balance(payment);
        let fee_balance = balance::split(&mut payment_balance, platform_fee);
        balance::join(&mut marketplace.treasury, fee_balance);

        // Convert remaining balance to coin and transfer to provider
        let provider_coin = coin::from_balance(payment_balance, ctx);
        transfer::public_transfer(provider_coin, listing.provider);

        // Update listing stats
        listing.purchase_count = listing.purchase_count + 1;

        // Update marketplace stats
        marketplace.total_sales = marketplace.total_sales + 1;
        marketplace.total_volume = marketplace.total_volume + listing.price;

        // Create access token for buyer
        let access = DatasetAccess {
            id: object::new(ctx),
            listing_id,
            walrus_blob_id: listing.walrus_blob_id,
            owner: buyer,
            purchased_at: sui::clock::timestamp_ms(clock),
            content_hash: listing.content_hash,
        };

        // Emit event
        let timestamp = sui::clock::timestamp_ms(clock);
        event::emit(DatasetPurchased {
            listing_id,
            buyer,
            price: listing.price,
            platform_fee,
            provider_payout,
            timestamp,
        });

        // Transfer access to buyer
        transfer::transfer(access, buyer);

        // Refund excess payment if any
        if (payment_amount > listing.price) {
            let refund_amount = payment_amount - listing.price;
            let refund_coin = coin::take(&mut marketplace.treasury, refund_amount, ctx);
            transfer::public_transfer(refund_coin, buyer);
        }
    }

    /// Delist a dataset (only provider can do this)
    ///
    /// Arguments:
    /// - marketplace: The shared Marketplace object
    /// - cap: The provider's ProviderCap
    /// - clock: The Sui clock object for timestamps
    /// - ctx: Transaction context
    public fun delist_dataset(
        marketplace: &mut Marketplace,
        cap: &ProviderCap,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let listing_id = cap.listing_id;
        assert!(table::contains(&marketplace.listings, listing_id), EListingNotFound);

        let listing = table::borrow_mut(&mut marketplace.listings, listing_id);
        assert!(listing.provider == tx_context::sender(ctx), ENotOwner);
        assert!(listing.active, EListingNotActive);

        // Mark as inactive
        listing.active = false;

        // Emit event
        let timestamp = sui::clock::timestamp_ms(clock);
        event::emit(DatasetDelisted {
            listing_id,
            provider: listing.provider,
            timestamp,
        });
    }

    // === View Functions ===

    /// Get listing details
    public fun get_listing(
        marketplace: &Marketplace,
        listing_id: ID,
    ): (
        String, // name
        String, // description
        String, // category
        String, // walrus_blob_id
        u64,    // size_bytes
        u64,    // price
        address, // provider
        bool,   // active
        u64,    // listed_at
        u64,    // purchase_count
    ) {
        assert!(table::contains(&marketplace.listings, listing_id), EListingNotFound);
        let listing = table::borrow(&marketplace.listings, listing_id);
        (
            listing.name,
            listing.description,
            listing.category,
            listing.walrus_blob_id,
            listing.size_bytes,
            listing.price,
            listing.provider,
            listing.active,
            listing.listed_at,
            listing.purchase_count,
        )
    }

    /// Get marketplace stats
    public fun get_marketplace_stats(
        marketplace: &Marketplace,
    ): (u64, u64, u64, u64) {
        (
            marketplace.total_listings,
            marketplace.total_sales,
            marketplace.total_volume,
            balance::value(&marketplace.treasury),
        )
    }

    /// Check if a listing is active
    public fun is_listing_active(
        marketplace: &Marketplace,
        listing_id: ID,
    ): bool {
        if (!table::contains(&marketplace.listings, listing_id)) {
            return false
        };
        let listing = table::borrow(&marketplace.listings, listing_id);
        listing.active
    }

    /// Get access details
    public fun get_access_details(
        access: &DatasetAccess,
    ): (ID, String, address, u64) {
        (
            access.listing_id,
            access.walrus_blob_id,
            access.owner,
            access.purchased_at,
        )
    }

    /// Get provider capability details
    public fun get_provider_cap_details(
        cap: &ProviderCap,
    ): ID {
        cap.listing_id
    }

    // === Admin Functions ===

    /// Withdraw platform fees (admin only)
    public fun withdraw_fees(
        marketplace: &mut Marketplace,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == marketplace.admin, ENotOwner);
        let amount = balance::value(&marketplace.treasury);
        let fees = coin::take(&mut marketplace.treasury, amount, ctx);
        transfer::public_transfer(fees, marketplace.admin);
    }

    /// Update platform fee (admin only, max 10%)
    public fun update_fee(
        marketplace: &mut Marketplace,
        new_fee_bps: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == marketplace.admin, ENotOwner);
        assert!(new_fee_bps <= 1000, EInvalidPrice); // Max 10%
        marketplace.fee_bps = new_fee_bps;
    }

    /// Pause/unpause marketplace (admin only)
    public fun set_paused(
        marketplace: &mut Marketplace,
        paused: bool,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == marketplace.admin, ENotOwner);
        marketplace.paused = paused;
    }

    // === Test-Only Functions ===

    #[test_only]
    /// Initialize marketplace for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
