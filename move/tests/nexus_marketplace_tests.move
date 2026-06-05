#[test_only]
module nexus::nexus_marketplace_tests {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx};
    use sui::test_utils::{assert_eq};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::object::ID;
    use std::string;
    use std::option;

    use nexus::nexus_marketplace::{
        Self,
        Marketplace,
        DatasetAccess,
        ProviderCap,
    };

    // === Test Constants ===

    const ADMIN: address = @0xAD;
    const PROVIDER: address = @0xBEEF;
    const BUYER: address = @0xCAFE;
    const BUYER2: address = @0xFACE;

    const PRICE: u64 = 1_000_000_000; // 1 SUI in MIST
    const SIZE_BYTES: u64 = 1024;
    const FEE_BPS: u64 = 200; // 2%

    fun expected_fee(price: u64): u64 { (price * FEE_BPS) / 10000 }

    // === Helper Functions ===

    fun setup(): Scenario {
        let mut scenario = test_scenario::begin(ADMIN);
        next_tx(&mut scenario, ADMIN);
        {
            nexus_marketplace::init_for_testing(ctx(&mut scenario));
        };
        scenario
    }

    fun create_test_clock(scenario: &mut Scenario): Clock {
        let mut clock = clock::create_for_testing(ctx(scenario));
        clock::set_for_testing(&mut clock, 1000);
        clock
    }

    /// List a default SUI-priced dataset (as PROVIDER) and return its listing ID.
    fun list_default(scenario: &mut Scenario, clock: &Clock): ID {
        list_with_seal(scenario, clock, b"")
    }

    /// List a default dataset with a given Seal policy id (b"" = not encrypted).
    fun list_with_seal(scenario: &mut Scenario, clock: &Clock, seal_policy_id: vector<u8>): ID {
        next_tx(scenario, PROVIDER);
        let mut marketplace = test_scenario::take_shared<Marketplace>(scenario);
        let listing_id = nexus_marketplace::list_dataset<SUI>(
            &mut marketplace,
            string::utf8(b"Test Dataset"),
            string::utf8(b"A test dataset"),
            string::utf8(b"embeddings"),
            string::utf8(b"blob-123"),
            SIZE_BYTES,
            PRICE,
            option::some(string::utf8(b"sha256:abc")),
            option::some(1u64),
            seal_policy_id,
            clock,
            ctx(scenario),
        );
        test_scenario::return_shared(marketplace);
        listing_id
    }

    // === Happy Path Tests ===

    #[test]
    fun test_marketplace_initialization() {
        let mut scenario = setup();
        next_tx(&mut scenario, ADMIN);
        {
            let marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let (total_listings, total_sales, total_volume, treasury) =
                nexus_marketplace::get_marketplace_stats(&marketplace);
            assert_eq(total_listings, 0);
            assert_eq(total_sales, 0);
            assert_eq(total_volume, 0);
            assert_eq(treasury, 0);
            test_scenario::return_shared(marketplace);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_list_dataset() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock);

        next_tx(&mut scenario, PROVIDER);
        {
            let marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let (name, _, cat, blob, size, price, provider, active, _, count) =
                nexus_marketplace::get_listing(&marketplace, listing_id);
            assert_eq(name, string::utf8(b"Test Dataset"));
            assert_eq(cat, string::utf8(b"embeddings"));
            assert_eq(blob, string::utf8(b"blob-123"));
            assert_eq(size, SIZE_BYTES);
            assert_eq(price, PRICE);
            assert_eq(provider, PROVIDER);
            assert_eq(active, true);
            assert_eq(count, 0);

            let (total_listings, total_sales, total_volume, treasury) =
                nexus_marketplace::get_marketplace_stats(&marketplace);
            assert_eq(total_listings, 1);
            assert_eq(total_sales, 0);
            assert_eq(total_volume, 0);
            assert_eq(treasury, 0);
            test_scenario::return_shared(marketplace);
        };

        // Provider holds a ProviderCap for the listing.
        next_tx(&mut scenario, PROVIDER);
        {
            let cap = test_scenario::take_from_sender<ProviderCap>(&scenario);
            assert_eq(nexus_marketplace::get_provider_cap_details(&cap), listing_id);
            test_scenario::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_list_dataset_max_price() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);

        next_tx(&mut scenario, PROVIDER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let high_price = 1_000_000_000_000; // 1000 SUI
            let listing_id = nexus_marketplace::list_dataset<SUI>(
                &mut marketplace,
                string::utf8(b"Expensive Dataset"),
                string::utf8(b"A very expensive dataset"),
                string::utf8(b"model-weights"),
                string::utf8(b"expensive-blob"),
                SIZE_BYTES,
                high_price,
                option::none(),
                option::some(100u64),
                b"",
                &clock,
                ctx(&mut scenario),
            );
            let (_, _, _, _, _, price, _, _, _, _) =
                nexus_marketplace::get_listing(&marketplace, listing_id);
            assert_eq(price, high_price);
            test_scenario::return_shared(marketplace);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_buy_dataset() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock);

        // Buyer purchases with exact price.
        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario));

            let (_, total_sales, total_volume, treasury) =
                nexus_marketplace::get_marketplace_stats(&marketplace);
            assert_eq(total_sales, 1);
            assert_eq(total_volume, PRICE);
            assert_eq(treasury, 0); // fees are paid out to admin, not pooled
            assert_eq(nexus_marketplace::has_purchased(&marketplace, listing_id, BUYER), true);
            assert_eq(nexus_marketplace::has_purchased(&marketplace, listing_id, BUYER2), false);
            test_scenario::return_shared(marketplace);
        };

        // Admin received the 2% platform fee.
        next_tx(&mut scenario, ADMIN);
        {
            let fee = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&fee), expected_fee(PRICE));
            test_scenario::return_to_sender(&scenario, fee);
        };

        // Buyer now owns a DatasetAccess bound to the listing.
        next_tx(&mut scenario, BUYER);
        {
            let access = test_scenario::take_from_sender<DatasetAccess>(&scenario);
            let (acc_listing, acc_blob, acc_owner, _) = nexus_marketplace::get_access_details(&access);
            assert_eq(acc_listing, listing_id);
            assert_eq(acc_blob, string::utf8(b"blob-123"));
            assert_eq(acc_owner, BUYER);
            test_scenario::return_to_sender(&scenario, access);
        };

        // Provider received exactly price - fee.
        next_tx(&mut scenario, PROVIDER);
        {
            let payout = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&payout), PRICE - expected_fee(PRICE));
            test_scenario::return_to_sender(&scenario, payout);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// Regression test for the refund-from-treasury bug (Blockers.md B-4):
    /// overpayment must be refunded from the buyer's OWN coin, and the treasury
    /// must only ever hold the fee on `price`.
    #[test]
    fun test_buy_dataset_overpayment_refunds_from_payment() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock);

        let overpay = PRICE + 500_000_000; // pay 1.5 SUI for a 1 SUI listing

        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(overpay, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario));

            let (_, _, total_volume, treasury) = nexus_marketplace::get_marketplace_stats(&marketplace);
            assert_eq(treasury, 0); // pooled treasury unused; fee paid to admin
            assert_eq(total_volume, PRICE);
            test_scenario::return_shared(marketplace);
        };

        // Admin received exactly the fee on `price` (not on the overpayment).
        next_tx(&mut scenario, ADMIN);
        {
            let fee = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&fee), expected_fee(PRICE));
            test_scenario::return_to_sender(&scenario, fee);
        };

        // Buyer was refunded exactly the overpayment.
        next_tx(&mut scenario, BUYER);
        {
            let refund = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&refund), overpay - PRICE);
            test_scenario::return_to_sender(&scenario, refund);
        };

        // Provider still received exactly price - fee (not the overpayment).
        next_tx(&mut scenario, PROVIDER);
        {
            let payout = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&payout), PRICE - expected_fee(PRICE));
            test_scenario::return_to_sender(&scenario, payout);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_delist_dataset() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock);

        next_tx(&mut scenario, PROVIDER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let cap = test_scenario::take_from_sender<ProviderCap>(&scenario);
            assert_eq(nexus_marketplace::is_listing_active(&marketplace, listing_id), true);
            nexus_marketplace::delist_dataset(&mut marketplace, &cap, &clock, ctx(&mut scenario));
            assert_eq(nexus_marketplace::is_listing_active(&marketplace, listing_id), false);
            test_scenario::return_shared(marketplace);
            test_scenario::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_full_lifecycle() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);

        // 1. List
        let listing_id = list_default(&mut scenario, &clock);

        // 2. Buy
        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario));
            test_scenario::return_shared(marketplace);
        };

        // 3. Verify access minted
        next_tx(&mut scenario, BUYER);
        {
            let access = test_scenario::take_from_sender<DatasetAccess>(&scenario);
            let (acc_listing, _, acc_owner, _) = nexus_marketplace::get_access_details(&access);
            assert_eq(acc_listing, listing_id);
            assert_eq(acc_owner, BUYER);
            test_scenario::return_to_sender(&scenario, access);
        };

        // 4. Delist
        next_tx(&mut scenario, PROVIDER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let cap = test_scenario::take_from_sender<ProviderCap>(&scenario);
            nexus_marketplace::delist_dataset(&mut marketplace, &cap, &clock, ctx(&mut scenario));
            // 5. Verify inactive
            assert_eq(nexus_marketplace::is_listing_active(&marketplace, listing_id), false);
            test_scenario::return_shared(marketplace);
            test_scenario::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    // === Failure State Tests ===

    #[test]
    #[expected_failure(abort_code = nexus::nexus_marketplace::EInvalidPrice)]
    fun test_list_dataset_zero_price_fails() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);

        next_tx(&mut scenario, PROVIDER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let _id = nexus_marketplace::list_dataset<SUI>(
                &mut marketplace,
                string::utf8(b"Zero"),
                string::utf8(b"zero price"),
                string::utf8(b"embeddings"),
                string::utf8(b"blob"),
                SIZE_BYTES,
                0, // invalid → EInvalidPrice
                option::none(),
                option::none(),
                b"",
                &clock,
                ctx(&mut scenario),
            );
            test_scenario::return_shared(marketplace);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nexus::nexus_marketplace::EInsufficientPayment)]
    fun test_buy_insufficient_payment_fails() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock);

        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE - 1, ctx(&mut scenario)); // too little
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario));
            test_scenario::return_shared(marketplace);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// Regression test for duplicate-purchase prevention (Blockers.md B-5).
    #[test]
    #[expected_failure(abort_code = nexus::nexus_marketplace::EAlreadyPurchased)]
    fun test_double_purchase_fails() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock);

        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario));
            test_scenario::return_shared(marketplace);
        };

        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario)); // aborts
            test_scenario::return_shared(marketplace);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nexus::nexus_marketplace::EListingNotActive)]
    fun test_buy_delisted_listing_fails() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock);

        // Provider delists.
        next_tx(&mut scenario, PROVIDER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let cap = test_scenario::take_from_sender<ProviderCap>(&scenario);
            nexus_marketplace::delist_dataset(&mut marketplace, &cap, &clock, ctx(&mut scenario));
            test_scenario::return_shared(marketplace);
            test_scenario::return_to_sender(&scenario, cap);
        };

        // Buyer attempts to purchase the now-inactive listing.
        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario)); // aborts
            test_scenario::return_shared(marketplace);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// The provider ownership guard holds even if the ProviderCap is moved to
    /// another address (ENotOwner, not just cap possession).
    #[test]
    #[expected_failure(abort_code = nexus::nexus_marketplace::ENotOwner)]
    fun test_delist_by_non_provider_fails() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let _listing_id = list_default(&mut scenario, &clock);

        // Provider hands their cap to BUYER2.
        next_tx(&mut scenario, PROVIDER);
        {
            let cap = test_scenario::take_from_sender<ProviderCap>(&scenario);
            transfer_cap_to(cap, BUYER2);
        };

        // BUYER2 holds the cap but is not the provider → ENotOwner.
        next_tx(&mut scenario, BUYER2);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let cap = test_scenario::take_from_sender<ProviderCap>(&scenario);
            nexus_marketplace::delist_dataset(&mut marketplace, &cap, &clock, ctx(&mut scenario)); // aborts
            test_scenario::return_shared(marketplace);
            test_scenario::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    fun transfer_cap_to(cap: ProviderCap, recipient: address) {
        sui::transfer::public_transfer(cap, recipient);
    }

    // === Multi-token + Seal tests ===

    /// A stand-in non-SUI coin type, to prove payment-token enforcement.
    public struct FAKE has drop {}

    #[test]
    #[expected_failure(abort_code = nexus::nexus_marketplace::EWrongPaymentToken)]
    fun test_buy_with_wrong_token_fails() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_default(&mut scenario, &clock); // priced in SUI

        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<FAKE>(PRICE, ctx(&mut scenario)); // wrong token
            nexus_marketplace::buy_dataset<FAKE>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario)); // aborts
            test_scenario::return_shared(marketplace);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_seal_policy_propagates_and_approves() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let policy = b"seal-policy-xyz";
        let listing_id = list_with_seal(&mut scenario, &clock, policy);

        // Buy the encrypted dataset.
        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario));
            test_scenario::return_shared(marketplace);
        };

        // The access carries the policy, and seal_approve accepts the match.
        next_tx(&mut scenario, BUYER);
        {
            let access = test_scenario::take_from_sender<DatasetAccess>(&scenario);
            assert_eq(nexus_marketplace::get_access_seal_policy(&access), policy);
            nexus_marketplace::call_seal_approve(policy, &access); // must not abort
            test_scenario::return_to_sender(&scenario, access);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nexus::nexus_marketplace::ENoAccess)]
    fun test_seal_approve_rejects_wrong_identity() {
        let mut scenario = setup();
        let clock = create_test_clock(&mut scenario);
        let listing_id = list_with_seal(&mut scenario, &clock, b"the-real-policy");

        next_tx(&mut scenario, BUYER);
        {
            let mut marketplace = test_scenario::take_shared<Marketplace>(&scenario);
            let payment = coin::mint_for_testing<SUI>(PRICE, ctx(&mut scenario));
            nexus_marketplace::buy_dataset<SUI>(&mut marketplace, listing_id, payment, &clock, ctx(&mut scenario));
            test_scenario::return_shared(marketplace);
        };

        next_tx(&mut scenario, BUYER);
        {
            let access = test_scenario::take_from_sender<DatasetAccess>(&scenario);
            nexus_marketplace::call_seal_approve(b"a-different-policy", &access); // aborts ENoAccess
            test_scenario::return_to_sender(&scenario, access);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
}
