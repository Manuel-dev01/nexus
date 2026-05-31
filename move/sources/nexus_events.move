/// Nexus Events — Event definitions for indexing
///
/// Events are emitted on every marketplace state change so the
/// SvelteKit frontend and Tatum MCP server can index them.
module nexus::nexus_events {
    // Phase 2: Full implementation
    // - DatasetListed { listing_id, provider, walrus_blob_id, price }
    // - DatasetPurchased { listing_id, buyer, walrus_blob_id, price }
    // - DatasetDelisted { listing_id, provider }
}
