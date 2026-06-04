/// nexus_events.move — Event definitions for indexing
///
/// Events are emitted on every marketplace state change so the
/// SvelteKit frontend and Tatum MCP server can index them.
///
/// Note: Event structs are defined in nexus_marketplace.move and
/// re-exported here for cleaner imports in other modules.
module nexus::nexus_events {
    use sui::object::ID;
    use std::string::String;

    // Re-export event types from nexus_marketplace
    // These are defined in the marketplace module but can be
    // imported from here for convenience

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

    // Event creation functions for external modules
    public fun new_dataset_listed(
        listing_id: ID,
        name: String,
        category: String,
        walrus_blob_id: String,
        size_bytes: u64,
        price: u64,
        provider: address,
        timestamp: u64,
    ): DatasetListed {
        DatasetListed {
            listing_id,
            name,
            category,
            walrus_blob_id,
            size_bytes,
            price,
            provider,
            timestamp,
        }
    }

    public fun new_dataset_purchased(
        listing_id: ID,
        buyer: address,
        price: u64,
        platform_fee: u64,
        provider_payout: u64,
        timestamp: u64,
    ): DatasetPurchased {
        DatasetPurchased {
            listing_id,
            buyer,
            price,
            platform_fee,
            provider_payout,
            timestamp,
        }
    }

    public fun new_dataset_delisted(
        listing_id: ID,
        provider: address,
        timestamp: u64,
    ): DatasetDelisted {
        DatasetDelisted {
            listing_id,
            provider,
            timestamp,
        }
    }
}
