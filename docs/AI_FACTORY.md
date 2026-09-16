# AI factory

The factory boundary is represented by independent queue jobs and `runEngineeringPipeline`. AI may propose parameters or a revision proposal, but it cannot write `VERIFIED`. The verification service owns that decision.

Revision loops must be bounded by `MAX_DESIGN_ITERATIONS`; exceeding the limit requires human review.

`AIProviderRouter` only reports a configured provider as available. It never generates a fake engineering answer when no model is configured.
