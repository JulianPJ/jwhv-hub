# Direct-source discovery policy

This policy exists so scheduled research can find useful opportunities without turning JWHV Hub into a scraper of third-party aggregators.

## Jobs

A candidate job may use `source_id: direct-employer-public-listing` only when:

- the canonical URL belongs to the employer or an employer-authorised careers system
- the posting is publicly accessible without bypassing access controls
- only concise factual metadata is stored
- the dashboard links users back to the original application page
- Working Holiday, language, salary, accommodation and other claims remain `unknown` unless directly supported

Commercial job-board search results may be used for discovery, but the board itself must not become the canonical source unless separately approved in `data/sources.json`.

## Housing

A candidate housing record may use `source_id: direct-housing-provider-public-listing` only when:

- the canonical URL belongs to the property operator/provider
- the page is publicly accessible
- the dashboard stores concise factual metadata rather than copied descriptions or images
- the original provider page remains the place where the user checks availability and applies/enquires
- rent, fees, minimum stay, furnished status, guarantor requirements and foreigner eligibility are not inferred from silence

Third-party housing aggregators require separate approval before they can be canonical data sources.

## Prohibited behaviour

Workers must not bypass CAPTCHAs, login walls, robots controls, rate limits or technical restrictions, and must not reproduce substantial copyrighted text.
