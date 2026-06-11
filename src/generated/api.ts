/**
 * Slothbox API types — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Generated from the pinned ../../openapi.json (79 operations) by
 * openapi-typescript v7.13.0 via `npm run generate`.
 *
 * The pinned spec mirrors the published one at
 * https://slothbox-api-publicassetsbucket-mjdmnco0nf5t.s3.eu-west-2.amazonaws.com/openapi.json
 * — see README.md ("Generated types") for the refresh procedure.
 */

export interface paths {
    "/hello": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health check */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalog/services": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List supported services
         * @description Catalog of services environment templates can include (postgres, redis, dynamodb-local, mysql). Populates the "Add service" picker in the web UI.
         */
        get: operations["listCatalogServices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalog/runtimes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List supported language runtimes
         * @description Catalog of language runtimes that projects can declare via the `runtime:` field (e.g. `node:22`). Populates the runtime dropdown in the project form.
         */
        get: operations["listCatalogRuntimes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalog/docker-hub/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search Docker Hub repositories
         * @description Proxies to Docker Hub search (`/v2/search/repositories/`). Returns up to 20 results sorted with Official images first, then by pull count descending. Results are cached for 30 minutes per query in the Lambda container. Useful for powering the custom-image autocomplete in the template builder.
         */
        get: operations["searchDockerHub"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalog/docker-hub/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Docker Hub image tags
         * @description Returns the 25 most recently pushed tags for a Docker Hub repository, sorted newest first. Digest-only tags (`sha256:…`) are filtered out. Library images (no `/` in the name, e.g. `postgres`) are mapped to the `library/` namespace automatically. Results are cached for 10 minutes per image name.
         */
        get: operations["listDockerHubTags"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalog/docker-hub/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check that a Docker Hub image tag exists
         * @description Resolves a Docker Hub `image:tag` to its content digest so the template builder can validate a tag early (on the Services step) instead of failing at save. Only Docker Hub images are checked: a non-Hub registry (a host with a `.`/`:` before the first `/`, e.g. `ghcr.io/...` or an ECR URI) returns `unsupported` without any outbound call — those are verified at bake time. Resolved results are cached for 5 minutes per `image:tag`; transient (`error`) results are never cached.
         */
        get: operations["resolveDockerHubImage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Current user and their organizations */
        get: operations["getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/members/{userId}/git-ssh-key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the caller's per-org Git SSH key metadata
         * @description Returns the public key + fingerprint for the caller in this org. The private key is never returned via the API; it lives KMS-encrypted in DynamoDB and is only emitted into env bootstrap user-data at launch time.
         */
        get: operations["getGitSshKey"];
        put?: never;
        /**
         * Generate a per-org Git SSH key for the caller
         * @description Generates an ed25519 keypair server-side, stores the private key KMS-encrypted, and pushes the public key to the GitHub account bound for this user in this org. Used by Slothbox dev environments launched inside the org to clone, pull, and push to private repos. Replaces any existing key for this (org, user) -- the previous GitHub-side key is revoked first.
         */
        post: operations["generateGitSshKey"];
        /**
         * Revoke the caller's per-org Git SSH key
         * @description Removes the key from GitHub (best-effort -- using the org's bound GitHub token, if still available) and forgets the encrypted private key.
         */
        delete: operations["revokeGitSshKey"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/github": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the caller’s GitHub link, if any */
        get: operations["getGithubLink"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the caller’s linked external accounts
         * @description The caller’s connection library across providers. Optionally filter with `?provider=github`. Tokens are never returned.
         */
        get: operations["listMyConnections"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List your organizations
         * @description Returns per-org membership summaries (org id/name plus your role, the MFA requirement, and your granted permissions) — the same shape as the `organizations` array on `GET /me`.
         */
        get: operations["listOrganizations"];
        put?: never;
        /**
         * Create an organization
         * @description The caller automatically becomes the first owner.
         */
        post: operations["createOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an organization */
        get: operations["getOrganization"];
        put?: never;
        post?: never;
        /**
         * Delete an organization
         * @description Owner only. Removes all members and invites.
         */
        delete: operations["deleteOrganization"];
        options?: never;
        head?: never;
        /**
         * Update an organization
         * @description Owner only.
         */
        patch: operations["updateOrganization"];
        trace?: never;
    };
    "/organizations/{orgId}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List members */
        get: operations["listMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/members/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove a member
         * @description Owners can remove anyone; non-owners can only remove themselves. Refuses removal of the last owner.
         */
        delete: operations["removeMember"];
        options?: never;
        head?: never;
        /**
         * Set a member's permissions
         * @description Owner only. Replaces the member’s granted capabilities. The owner’s permissions are implicit and cannot be set.
         */
        patch: operations["setMemberPermissions"];
        trace?: never;
    };
    "/organizations/{orgId}/transfer-ownership": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Transfer organization ownership
         * @description Owner only. Hands ownership to another member; the caller becomes a regular member.
         */
        post: operations["transferOwnership"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/members/{userId}/connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a member’s connection bindings in this org
         * @description Self or owner. Which library connection the member uses per provider here.
         */
        get: operations["listMemberConnections"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/members/{userId}/connections/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Choose which of your connections to use in this org
         * @description Connections are personal: only the user themselves can set this (org owners cannot). Points at one of *your own* library connections for this provider in this org. `{userId}` must be the caller.
         */
        put: operations["setMemberConnection"];
        post?: never;
        /**
         * Clear your connection binding for a provider in this org
         * @description Connections are personal: only the user themselves can clear this. `{userId}` must be the caller.
         */
        delete: operations["clearMemberConnection"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/invites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List pending invites */
        get: operations["listInvites"];
        put?: never;
        /**
         * Invite someone by email
         * @description Sends an invite email and returns the invite URL.
         */
        post: operations["createInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/invites/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke an invite */
        delete: operations["revokeInvite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invites/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Public invite preview
         * @description Lets a client render the invite landing page before the recipient signs in.
         */
        get: operations["previewInvite"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invites/{token}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept an invite
         * @description Caller must be signed in as the invited email address.
         */
        post: operations["acceptInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List environment templates in an organisation */
        get: operations["listTemplates"];
        put?: never;
        /**
         * Create an environment template
         * @description An environment template defines the shape of an EC2-based dev environment: services to install, runtimes needed, projects to clone + bootstrap. Owner-only. A full body is validated and starts a bake (`bundle_building` → `ready` / `bundle_failed`). A draft body (`{ draft: true, name, draftState }`) is stored verbatim in `draft` status with no bake, to be resumed and published later.
         */
        post: operations["createTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/templates/{templateId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an environment template with services + projects */
        get: operations["getTemplate"];
        put?: never;
        post?: never;
        /** Delete an environment template */
        delete: operations["deleteTemplate"];
        options?: never;
        head?: never;
        /**
         * Replace an environment template
         * @description Replaces every nested service and project atomically. Send the full desired state, not a diff. If the runtime bundle hash changes, the next launch picks up a re-bake. A draft body (`{ draft: true, name, draftState }`) re-saves the in-progress state and is only allowed while the template is still a draft; sending a full body publishes the draft.
         */
        patch: operations["replaceTemplate"];
        trace?: never;
    };
    "/organizations/{orgId}/templates/{templateId}/rebake": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Force a fresh AMI bake for an environment template
         * @description Use when a previous bake failed (e.g. transient AWS issue, fixed permissions in the customer account) and you want to retry without first making a definition change. Idempotent on a healthy bundle -- a `ready` bundle stays ready; a `building` one is left alone; a `failed` or absent bundle gets a fresh bake.
         */
        post: operations["rebakeTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/templates/{templateId}/check-updates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Check whether any service images have a newer digest
         * @description Re-resolves the current tag → digest for every curated catalog service and returns those that differ from the pinned digest (or were never pinned). Read-only — does not mutate any data. Custom/BYO images are skipped. An empty `updates` array means all catalog images are up to date.
         */
        post: operations["checkTemplateUpdates"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/templates/{templateId}/repin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Re-pin all curated service digests to the current registry values
         * @description Re-resolves each curated catalog service image and, for any whose digest has changed, updates the pinned `resolvedDigest` in DynamoDB and recomputes the bundle hash. A changed hash makes the previous baked AMI stale — trigger a rebake to apply the new pins. Idempotent: re-pinning to the same digest is a no-op per service. Requires `templates:write`.
         */
        post: operations["repinTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/environments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List environment instances in an organisation
         * @description Returns every box in the org (each box’s `mine` flag marks the ones the caller launched); status is refreshed against live EC2 state on read.
         */
        get: operations["listEnvironments"];
        put?: never;
        /**
         * Launch an environment instance ("box") from a template
         * @description Launches an EC2 box in the org's connected AWS account from the template's baked AMI. Requires org membership and an active AWS connection whose runtime bundle is `ready`. Returns immediately with a `pending` box; provisioning runs asynchronously — poll the box until it reaches `running`.
         *
         *     Send an `Idempotency-Key` header to make the launch retry-safe: repeating the same key (same org, same request body) within 24 hours replays the original `201` response — marked with an `Idempotency-Replayed: true` response header — instead of provisioning a second box. Concurrent duplicates are race-safe: only one launch happens and the other request receives it. Reusing a key with a *different* request body is rejected with `409`.
         */
        post: operations["launchEnvironment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/environments/{envId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get an environment instance
         * @description Status is refreshed against live EC2 state on read.
         */
        get: operations["getEnvironment"];
        put?: never;
        post?: never;
        /**
         * Terminate an environment instance
         * @description Restricted to the user who launched the box, or a member with the environments:delete permission (which owners hold implicitly). Terminates the EC2 instance; the box row stays (`terminating` → `terminated`) but is auto-deleted ~30 days later via DynamoDB TTL.
         */
        delete: operations["terminateEnvironment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/environments/{envId}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get an environment instance’s host-metrics time series
         * @description Returns the box’s host metrics (CPU, memory, disk, load, network) reported by the daemon, for charting. Any org member may read. Use `?range=` to select the window — one of `30m`, `1h`, `6h`, `24h`, `48h` (default `30m`). Samples are server-side downsampled to at most 240 time-bucketed average points; the `latest` field carries the most recent raw snapshot. Samples are retained for 48h.
         */
        get: operations["getEnvironmentMetrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/environments/{envId}/stop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Stop a running environment instance
         * @description Restricted to the user who launched the box, or a member with the environments:delete permission (which owners hold implicitly).
         */
        post: operations["stopEnvironment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/environments/{envId}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start a stopped environment instance
         * @description Restricted to the user who launched the box, or a member with the environments:delete permission (which owners hold implicitly).
         */
        post: operations["startEnvironment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/auto-sleep": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the org’s auto-sleep policy
         * @description Any member. Returns the org-level idle-auto-stop + scheduled-sleep policy (or null if unset) and the built-in defaults unset leaves fall back to. Templates can override it per-leaf.
         */
        get: operations["getAutoSleepPolicy"];
        /**
         * Set the org’s auto-sleep policy
         * @description Owner only. Idle timeout changes apply to newly launched boxes (the daemon enforces the value baked in at launch); schedule changes apply to running boxes on the next sweep.
         */
        put: operations["setAutoSleepPolicy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/templates/{templateId}/auto-sleep": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set or clear a template’s auto-sleep override
         * @description Owner only. Send `{ autoSleep: <partial policy> }` to override the org policy per-leaf for boxes from this template, or `{ autoSleep: null }` to clear it. Does not trigger a rebake.
         */
        put: operations["setTemplateAutoSleep"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the organisation audit log
         * @description Requires the audit:read permission. Returns org-wide events newest-first. Narrow with `?userId=` (one member’s actions in this org) or `?resourceType=&resourceId=` (one resource). Filter with `?action=`, `?from=`/`?to=` (ISO-8601), `?limit=` (max 100), and page with `?cursor=`.
         */
        get: operations["listOrgAuditEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read your own account audit log
         * @description Your account-level events (login, MFA, API-key lifecycle). Supports the same `?action=`/`?from=`/`?to=`/`?limit=`/`?cursor=` filters.
         */
        get: operations["listMyAuditEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/api-keys/{keyId}/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read one of your API keys’ activity
         * @description Everything done with this API key, across every org. Owner only. Supports the same `?action=`/`?from=`/`?to=`/`?limit=`/`?cursor=` filters.
         */
        get: operations["listApiKeyAuditEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/aws-connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List AWS connections */
        get: operations["listAwsConnections"];
        put?: never;
        /**
         * Begin an AWS connection
         * @description Mints an external ID and returns a one-click CloudFormation quick-launch URL the customer can run in their own AWS account.
         */
        post: operations["createAwsConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/aws-connections/{connectionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an AWS connection */
        get: operations["getAwsConnection"];
        put?: never;
        post?: never;
        /** Delete an AWS connection */
        delete: operations["deleteAwsConnection"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/aws-connections/{connectionId}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify the AWS connection
         * @description Slothbox attempts `sts:AssumeRole` against the supplied role ARN with the connection’s external ID. On success the connection moves to `active`.
         */
        post: operations["verifyAwsConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/aws-connections/template.yaml": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Customer CloudFormation template
         * @description Public YAML template customers deploy into their AWS account to grant Slothbox the assume-role permissions it needs.
         */
        get: operations["getAwsConnectionTemplate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/secrets-settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Configure where the org stores its config
         * @description Owner only. Picks the secrets backend (SSM Parameter Store or Secrets Manager), the AWS connection whose account holds the values, and the region. Must be set before any secret or variable can be created — both kinds live in the org's own AWS account, never in Slothbox.
         */
        put: operations["setSecretsConfig"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/repos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the repos referenced across the org’s templates
         * @description Any member. Repos are deduped by normalized git URL; use `repoId` as the `scope=repo` reference when setting per-repo config.
         */
        get: operations["listOrgRepos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/env-config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List secrets + variables for an org
         * @description Any member. Variable values are fetched from the org account and included; secrets return metadata only (their values are never exposed). Pass `?templateId=` to limit template-scoped entries to one template.
         */
        get: operations["listEnvConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/env-config/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Create or update a secret or variable
         * @description Owner only. `{key}` is the env var name. Both kinds are written to the org's connected AWS account (secrets via the chosen backend; variables as SSM String params) and only metadata is kept in Slothbox. Scope determines the refs required: org needs none; repo needs `repoId`; template needs `templateId`; environment needs `environmentId`.
         */
        put: operations["upsertEnvConfig"];
        post?: never;
        /**
         * Delete a secret or variable
         * @description Owner only. Identify the entry with `?scope=` and `?kind=` (plus `repoId`/`templateId`/`environmentId` for non-org scopes). The value is also removed from the connected AWS account. Idempotent.
         */
        delete: operations["deleteEnvConfig"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/registry-credentials": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List private-registry credentials
         * @description Any member. Returns metadata only — the registry token is never exposed. Use a credential’s id as `registryCredentialId` on a custom template service.
         */
        get: operations["listRegistryCredentials"];
        put?: never;
        /**
         * Add a private-registry credential
         * @description Requires the settings:write permission (owners hold it implicitly). A `token` credential's secret is written to the org's own AWS account (SSM SecureString) and is never stored in Slothbox; `ecr` credentials carry no secret and use the box's instance role. Requires the org's secrets backend to be configured first.
         */
        post: operations["createRegistryCredential"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/registry-credentials/{credentialId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a private-registry credential
         * @description Requires the settings:write permission (owners hold it implicitly). Also removes the stored token from the org account (best-effort). Idempotent.
         *
         *     If any templates in the org reference this credential the request returns **409 Conflict** with a list of affected templates, rather than silently breaking bake-time docker auth. Pass `?force=true` to delete anyway; the response will be `200 OK` with `{ deleted: true, affectedTemplates: [...] }` so the UI can warn the user which templates are now broken.
         */
        delete: operations["deleteRegistryCredential"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/runtime-bundles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List runtime bundles in an organisation
         * @description Owner-only. Returns every bundle ever built into any of the org's connected AWS accounts.
         */
        get: operations["listRuntimeBundles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/runtime-bundles/{hash}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List bake events for a bundle
         * @description Owner-only. Returns the bake event log in chronological order.
         */
        get: operations["listBakeEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/billing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Billing summary for an organisation
         * @description Owner only. Trial state, the card on file (if any), seat count and the resulting per-period total. Every member is a billable seat (£5/seat/mo or £36/seat/yr); new orgs get a 30-day no-card trial.
         */
        get: operations["getBillingSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/event-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the catalogue of webhook event types */
        get: operations["listWebhookEventTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List webhook endpoints */
        get: operations["listWebhookEndpoints"];
        put?: never;
        /**
         * Create a webhook endpoint
         * @description Registers an https endpoint to receive signed event deliveries. The signing secret is returned ONCE in the response.
         */
        post: operations["createWebhookEndpoint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/{endpointId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a webhook endpoint */
        get: operations["getWebhookEndpoint"];
        put?: never;
        post?: never;
        /** Delete a webhook endpoint */
        delete: operations["deleteWebhookEndpoint"];
        options?: never;
        head?: never;
        /** Update a webhook endpoint (url, events, or enable/disable) */
        patch: operations["updateWebhookEndpoint"];
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/{endpointId}/secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Reveal the current signing secret */
        get: operations["getWebhookSecret"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/{endpointId}/secret/roll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate the signing secret
         * @description Generates a new secret. By default the previous secret keeps verifying for a 24h overlap; pass expireOld=true to cut over immediately.
         */
        post: operations["rollWebhookSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/{endpointId}/ping": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send a test (webhook.ping) delivery */
        post: operations["pingWebhookEndpoint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/{endpointId}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List delivery attempts for an endpoint (newest first) */
        get: operations["listWebhookDeliveries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/{endpointId}/deliveries/{deliveryId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a single delivery */
        get: operations["getWebhookDelivery"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organizations/{orgId}/webhooks/{endpointId}/deliveries/{deliveryId}/redeliver": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replay a delivery (re-send the original event as a new delivery) */
        post: operations["redeliverWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Standard error envelope returned for any non-2xx response. */
        Error: {
            error: {
                message: string;
                /**
                 * @description Stable machine-readable error code (SLO-116). Present on responses where the status code alone is ambiguous (e.g. the launch 409s); most errors carry only a message. New codes may be added over time — treat unknown values as absent.
                 * @enum {string}
                 */
                code?: "seat_ceiling_exceeded" | "no_active_aws_connection" | "template_not_baked" | "environment_terminated" | "environment_launching" | "api_plan_required" | "rate_limited" | "sdk_requires_service_key";
                issues?: unknown;
            };
        };
        User: {
            /** @example a1b2c3d4-… */
            userId: string;
            /** Format: email */
            email: string;
            name?: string;
            /**
             * @description How the caller authenticated. `apikey` covers both personal and service-account keys.
             * @enum {string}
             */
            authMethod: "jwt" | "apikey";
            /** @description Whether the user has a TOTP authenticator enrolled. */
            mfaEnabled: boolean;
            /** @description Whether the user has seen the first-visit web-app guide. */
            hasSeenGuide: boolean;
        };
        /** @enum {string} */
        Role: "owner" | "member";
        /** @enum {string} */
        Permission: "templates:write" | "members:write" | "settings:write" | "environments:delete" | "audit:read";
        OrgMembershipSummary: {
            orgId: string;
            name: string;
            role: components["schemas"]["Role"];
            requireMfa: boolean;
            /** @description The caller's granted capabilities in this org (empty for owners). */
            permissions: components["schemas"]["Permission"][];
        };
        GithubLink: {
            login: string;
            githubUserId: number;
            name?: string;
            /** Format: uri */
            avatarUrl?: string;
            /** Format: email */
            email?: string;
            scopes: string[];
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            linkedAt: string;
        };
        LibraryConnection: {
            connectionId: string;
            /** @enum {string} */
            provider: "github";
            providerAccountId: string;
            display: {
                login: string;
                name?: string;
                /** Format: uri */
                avatarUrl?: string;
                /** Format: email */
                email?: string;
            };
            scopes: string[];
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            linkedAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
        };
        Organization: {
            /** @example org_01HXYZ… */
            orgId: string;
            name: string;
            ownerId: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /** @description When true, members must enrol MFA to use the org in the web app. */
            requireMfa: boolean;
        };
        CreateOrgRequest: {
            name: string;
        };
        UpdateOrgRequest: {
            name?: string;
            /** @description Owner only. Enforce MFA for all members. */
            requireMfa?: boolean;
        };
        Membership: {
            orgId: string;
            userId: string;
            /** Format: email */
            email: string;
            name?: string;
            role: components["schemas"]["Role"];
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            joinedAt: string;
            /** @description Granted capabilities for a member. Owners hold every permission implicitly. */
            permissions?: components["schemas"]["Permission"][];
        };
        MembershipWithGithub: components["schemas"]["Membership"] & {
            githubLogin?: string;
            /** Format: uri */
            githubAvatarUrl?: string;
            /** @description Whether the member has a TOTP authenticator enrolled. */
            mfaEnabled: boolean;
        };
        SetMemberPermissionsRequest: {
            /** @description The complete set of capabilities to grant the member (replaces existing). */
            permissions: components["schemas"]["Permission"][];
        };
        TransferOwnershipRequest: {
            /** @description The member who should become the new owner. */
            userId: string;
        };
        MemberBinding: {
            /** @enum {string} */
            provider: "github";
            connectionId: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            boundAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
        };
        SetMemberBindingRequest: {
            connectionId: string;
        };
        Invite: {
            orgId: string;
            /** @example invite-token-… */
            token: string;
            /** Format: email */
            email: string;
            role: components["schemas"]["Role"];
            invitedBy: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            expiresAt: string;
        };
        CreateInviteRequest: {
            /** Format: email */
            email: string;
            /**
             * @default member
             * @enum {string}
             */
            role: "owner" | "member";
        };
        PartialIdleAutoStopPolicy: {
            enabled?: boolean;
            timeoutMinutes?: number;
        };
        SleepWindow: {
            /** @description Days the window starts on; 0 = Sunday. */
            days: number[];
            /** @example 20:00 */
            start: string;
            /**
             * @description end <= start wraps past midnight.
             * @example 08:00
             */
            end: string;
        };
        PartialSleepSchedulePolicy: {
            enabled?: boolean;
            timezone?: string;
            windows?: components["schemas"]["SleepWindow"][];
        };
        /** @description Per-template auto-sleep override (SLO-22); overlays the org policy per-leaf. */
        PartialAutoSleepPolicy: {
            idleAutoStop?: components["schemas"]["PartialIdleAutoStopPolicy"];
            sleepSchedule?: components["schemas"]["PartialSleepSchedulePolicy"];
        };
        Template: {
            templateId: string;
            name: string;
            description?: string;
            region: string;
            /** @enum {string} */
            status: "draft" | "bundle_building" | "ready" | "bundle_failed";
            runtimeBundleHash: string;
            /** @description True when a ready template was baked on an older bake recipe than current — its AMI is stale and should be re-baked. */
            needsRebake: boolean;
            autoSleep?: components["schemas"]["PartialAutoSleepPolicy"];
            /** @description Present only while status is `draft` — the saved builder state to resume from. Cleared on publish. */
            draftState?: {
                [key: string]: unknown;
            };
            createdByUserId: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
        };
        ServiceSource: {
            /** @enum {string} */
            kind: "catalog";
            /** @example postgres */
            catalogKey: string;
        } | {
            /** @enum {string} */
            kind: "custom";
            /** @example ghcr.io/acme/db */
            image: string;
        };
        ServiceConfig: {
            /** @description Non-secret env baked into the image (merged over catalog defaults). */
            env?: {
                [key: string]: string;
            };
            command?: string | string[];
            ports?: number[];
            volumes?: string[];
            resources?: {
                cpus?: string;
                mem_limit?: string;
            };
        };
        TemplateServiceInput: {
            /**
             * @description Compose service name (unique within the template); defaults from the source.
             * @example postgres
             */
            name?: string;
            source: components["schemas"]["ServiceSource"];
            /** @example 16 */
            tag: string;
            /** @description Private custom images: the org registry credential to pull with. */
            registryCredentialId?: string;
            /** @description Custom images only: records the intent to track a floating (unpinned) tag — non-reproducible. In v1 this flag is recorded intent only: custom images are never digest-resolved by the API regardless of its value (only curated catalog images are pinned at save). */
            floating?: boolean;
            config?: components["schemas"]["ServiceConfig"];
        };
        TemplateService: components["schemas"]["TemplateServiceInput"] & {
            serviceId: string;
            /**
             * @description Digest pinned at save (`repo@digest`). In v1 only curated catalog images are resolved; custom/BYO images are never resolved by the API and always launch unpinned. Also absent for a catalog image whose resolution failed transiently.
             * @example sha256:6f9f…
             */
            resolvedDigest?: string;
        };
        TemplateHealthCheck: {
            /** @enum {string} */
            type: "http";
            url: string;
        } | {
            /** @enum {string} */
            type: "tcp";
        };
        TemplateEnvVar: {
            key: string;
            value: string;
        } | {
            key: string;
            secretRef: string;
        };
        TemplateProjectInput: {
            /** @example api */
            name: string;
            /** @example git@github.com:acme/checkout-api.git */
            gitUrl: string;
            branch?: string;
            /** @example node:22 */
            runtime: string;
            workingDir?: string;
            setupScript?: string;
            runCommand?: string;
            port?: number;
            autoStart?: boolean;
            dependsOn?: string[];
            healthCheck?: components["schemas"]["TemplateHealthCheck"];
            envVars?: components["schemas"]["TemplateEnvVar"][];
        };
        TemplateProject: components["schemas"]["TemplateProjectInput"] & {
            projectId: string;
        };
        TemplateWithChildren: {
            template: components["schemas"]["Template"];
            services: components["schemas"]["TemplateService"][];
            projects: components["schemas"]["TemplateProject"][];
            /**
             * @description Non-fatal warnings produced during save. Present when one or more curated service images could not be digest-pinned due to a transient registry failure — those services will use a floating tag until the template is saved again.
             * @example [
             *       "Could not pin image for service 'postgres' (postgres:16) — digest resolution failed transiently; the service will use a floating tag until next save"
             *     ]
             */
            warnings?: string[];
        };
        TemplateInput: {
            /** @example checkout-stack */
            name: string;
            description?: string;
            /** @example eu-west-2 */
            region: string;
            services: components["schemas"]["TemplateServiceInput"][];
            projects: components["schemas"]["TemplateProjectInput"][];
        };
        TemplateDraftInput: {
            /**
             * @description Marks this as a draft save: the contents are stored as-is and not validated until the template is published.
             * @enum {boolean}
             */
            draft: true;
            /**
             * @description Optional for drafts — shown as "Untitled draft" when absent.
             * @example checkout-stack
             */
            name?: string;
            /** @description Opaque blob of the builder's in-progress state, rehydrated by the web UI when the draft is resumed. */
            draftState: {
                [key: string]: unknown;
            };
        };
        WriteTemplateBody: components["schemas"]["TemplateInput"] | components["schemas"]["TemplateDraftInput"];
        TemplateListItem: components["schemas"]["Template"] & {
            /**
             * @description Catalog keys of the template's services, one per service (may repeat). Drives the service icons shown on the templates list.
             * @example [
             *       "postgres",
             *       "redis"
             *     ]
             */
            serviceKeys: string[];
            /**
             * @description Number of projects in the template.
             * @example 2
             */
            projectCount: number;
        };
        ServiceDigestUpdate: {
            serviceId: string;
            name: string;
            /** @example postgres */
            image: string;
            /** @example 16 */
            tag: string;
            /** @example sha256:abc… */
            currentDigest?: string;
            /** @example sha256:def… */
            newDigest: string;
        };
        CheckTemplateUpdatesResponse: {
            updates: components["schemas"]["ServiceDigestUpdate"][];
        };
        RepinTemplateServicesResponse: {
            /** @description Number of services whose digest was updated. */
            updated: number;
            updates: {
                serviceId: string;
                name: string;
                image: string;
                tag: string;
                currentDigest?: string;
                newDigest: string;
            }[];
        };
        /** @description Latest host-metrics snapshot reported on a `health` heartbeat. */
        EnvironmentMetricsSample: {
            cpuPct?: number;
            memUsedBytes?: number;
            memTotalBytes?: number;
            diskUsedBytes?: number;
            diskTotalBytes?: number;
            load1?: number;
            netRxBytesPerSec?: number;
            netTxBytesPerSec?: number;
            diskReadBytesPerSec?: number;
            diskWriteBytesPerSec?: number;
        };
        Environment: {
            envId: string;
            name: string;
            templateId: string;
            awsConnectionId: string;
            /** @example eu-west-2 */
            region: string;
            /** @example t4g.medium */
            instanceType: string;
            /** @example i-0abc123def456 */
            instanceId?: string;
            amiId?: string;
            /** @enum {string} */
            status: "pending" | "provisioning" | "running" | "stopping" | "stopped" | "terminating" | "terminated" | "failed";
            statusReason?: string;
            createdByUserId: string;
            /** @description True when the authenticated caller launched this box. Lifecycle ops (start/stop/terminate/connect) are restricted to the launcher or a member with the environments:delete permission (which owners hold implicitly). */
            mine: boolean;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
            /**
             * Format: date-time
             * @description When the box was last (re)started after a stop.
             * @example 2026-05-22T14:23:00.000Z
             */
            lastStartedAt?: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            stoppedAt?: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            terminatedAt?: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            lastSeenAt?: string;
            lastMetrics?: components["schemas"]["EnvironmentMetricsSample"];
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            lastMetricsAt?: string;
            hasEgress?: boolean;
            /**
             * @description Set when the box was auto-stopped by the auto-sleep policy (SLO-22). Cleared on a manual start.
             * @enum {string}
             */
            autoStopReason?: "idle" | "scheduled";
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            autoStoppedAt?: string;
            /** @description Per-project clone/setup status reported by the serve agent (SLO-38). */
            projectSetup?: {
                name: string;
                /** @enum {string} */
                state: "pending" | "cloning" | "setup" | "ready" | "failed";
                message?: string;
                /**
                 * Format: date-time
                 * @example 2026-05-22T14:23:00.000Z
                 */
                updatedAt: string;
            }[];
            /** @description Per-service Docker bring-up status reported by the serve agent via service_setup events (SLO-99). `name` is the compose service name, or "compose" for the stack as a whole. */
            serviceSetup?: {
                name: string;
                /** @enum {string} */
                state: "started" | "ok" | "failed";
                message?: string;
                /**
                 * Format: date-time
                 * @example 2026-05-22T14:23:00.000Z
                 */
                updatedAt: string;
            }[];
            /** @description Latest per-container runtime state reported by the serve agent on every health heartbeat (SLO-138). Updated atomically; absent until the first health heartbeat that carries a non-empty services list. */
            containerHealth?: {
                /** @example postgres */
                name: string;
                /**
                 * @description Docker container state (running, exited, restarting, …).
                 * @example running
                 */
                state: string;
                /**
                 * @description Docker health check result (healthy, unhealthy, starting). Absent when the service has no HEALTHCHECK configured.
                 * @example healthy
                 */
                health?: string;
            }[];
        };
        LaunchEnvironmentRequest: {
            /** @example 01HXYZ… */
            templateId: string;
            /** @example checkout-dev */
            name?: string;
            /** @example t4g.large */
            instanceType?: string;
            /** @example eu-west-2 */
            region?: string;
        };
        EnvironmentMetricsPoint: {
            /** @description Sample/bucket time (ISO 8601). */
            t: string;
            cpuPct?: number;
            memUsedBytes?: number;
            memTotalBytes?: number;
            diskUsedBytes?: number;
            diskTotalBytes?: number;
            load1?: number;
            netRxBytesPerSec?: number;
            netTxBytesPerSec?: number;
            diskReadBytesPerSec?: number;
            diskWriteBytesPerSec?: number;
        };
        EnvironmentMetricsResponse: {
            envId: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            from: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            to: string;
            /** @description Server-side downsampled to at most 240 time-bucketed average points. */
            samples: components["schemas"]["EnvironmentMetricsPoint"][];
            latest: components["schemas"]["EnvironmentMetricsPoint"] & (Record<string, never> | null);
        };
        IdleAutoStopPolicy: {
            enabled: boolean;
            timeoutMinutes: number;
        };
        SleepSchedulePolicy: {
            enabled: boolean;
            /** @example Europe/London */
            timezone: string;
            windows: components["schemas"]["SleepWindow"][];
        };
        AutoSleepPolicy: {
            idleAutoStop: components["schemas"]["IdleAutoStopPolicy"];
            sleepSchedule: components["schemas"]["SleepSchedulePolicy"];
        };
        AuditEvent: {
            eventId: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            at: string;
            /** @example terminate */
            action: string;
            orgId?: string;
            actor: {
                /** @enum {string} */
                type: "user" | "apikey" | "system" | "daemon";
                id: string;
                /** @example jack@example.com */
                label: string;
                userId?: string;
                apiKeyId?: string;
            };
            resource?: {
                type: string;
                id: string;
                name?: string;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        AuditLogResponse: {
            events: components["schemas"]["AuditEvent"][];
            cursor?: string;
        };
        Connection: {
            connectionId: string;
            name: string;
            /** @enum {string} */
            status: "pending" | "active" | "failed";
            awsAccountId?: string;
            roleArn?: string;
            failureReason?: string;
            templateVersion: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            verifiedAt?: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            lastVerifiedAt?: string;
        };
        CreateConnectionRequest: {
            name: string;
            region?: string;
        };
        ConnectionListEntry: components["schemas"]["Connection"] & {
            updateAvailable: boolean;
        };
        ConnectionUpdate: {
            /** @enum {boolean} */
            available: false;
        } | {
            /** @enum {boolean} */
            available: true;
            currentVersion: string;
            yourVersion: string;
            /** Format: uri */
            templateUrl: string;
            /**
             * Format: uri
             * @description One-click CloudFormation console link to update the stack with the new template. Present when the stack ARN was captured (callback v7+).
             */
            quickUpdateUrl?: string;
            consoleInstructions: string;
            cliCommand: string;
        };
        VerifyConnectionRequest: {
            /** @example arn:aws:iam::123456789012:role/slothbox-connection */
            roleArn: string;
        };
        /** @enum {string} */
        SecretsBackend: "ssm" | "secretsmanager";
        SecretsConfig: {
            backend: components["schemas"]["SecretsBackend"];
            /** @description AWS connection whose account stores this org’s secrets. */
            connectionId: string;
            /** @example eu-west-2 */
            region: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
        };
        SetSecretsConfigRequest: {
            backend: components["schemas"]["SecretsBackend"];
            connectionId: string;
            /** @default eu-west-2 */
            region: string;
        };
        OrgRepo: {
            repoId: string;
            /** @example github.com/acme/checkout-api */
            repo: string;
            usedBy: {
                templateId: string;
                templateName: string;
                projectName: string;
                gitUrl: string;
            }[];
        };
        /** @enum {string} */
        EnvConfigScope: "org" | "repo" | "template" | "environment";
        EnvConfigItem: {
            scope: components["schemas"]["EnvConfigScope"];
            /** @enum {string} */
            kind: "secret" | "variable";
            /** @example DATABASE_URL */
            key: string;
            repoId?: string;
            /** @example github.com/acme/checkout-api */
            repo?: string;
            templateId?: string;
            environmentId?: string;
            /** @description Present only for variables (fetched from the org account). Secret values are never returned. */
            value?: string;
            backend?: components["schemas"]["SecretsBackend"];
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
            createdBy: string;
        };
        UpsertEnvConfigRequest: {
            scope: components["schemas"]["EnvConfigScope"];
            /** @enum {string} */
            kind: "secret" | "variable";
            value: string;
            /** @description Required for scope=repo. From GET /organizations/{orgId}/repos. */
            repoId?: string;
            /** @description repo scope: normalized git URL, for display. */
            repo?: string;
            templateId?: string;
            environmentId?: string;
        };
        RegistryCredential: {
            /** @example rc_01HXYZ… */
            credentialId: string;
            /** @example GHCR (acme) */
            label: string;
            /** @example ghcr.io */
            registry: string;
            /** @enum {string} */
            type: "token" | "ecr";
            username?: string;
            createdBy: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
        };
        CreateRegistryCredentialRequest: {
            /** @enum {string} */
            type: "token";
            label: string;
            /** @example ghcr.io */
            registry: string;
            username: string;
            /** @description Registry token/password — stored in the org account, never returned. */
            secret: string;
        } | {
            /** @enum {string} */
            type: "ecr";
            label: string;
            /** @example 123456789012.dkr.ecr.eu-west-2.amazonaws.com */
            registry: string;
        };
        BakeServiceConstituent: {
            /** @example postgres */
            name: string;
            /** @example postgres */
            image: string;
            /** @example 16 */
            tag: string;
            /** @example sha256:6f9f… */
            resolvedDigest?: string;
            registryCredentialId?: string;
            environment?: {
                [key: string]: string;
            };
            ports: number[];
            volumes: string[];
            namedVolumes: string[];
            command?: string | string[];
            resources?: {
                cpus?: string;
                mem_limit?: string;
            };
        };
        BundleConstituent: {
            key: string;
            version: string;
        };
        RuntimeBundle: {
            bundleHash: string;
            awsAccountId: string;
            region: string;
            /** @enum {string} */
            status: "building" | "ready" | "failed";
            amiId?: string;
            failureReason?: string;
            constituents: {
                services: components["schemas"]["BakeServiceConstituent"][];
                runtimes: components["schemas"]["BundleConstituent"][];
            };
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            startedAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            builtAt?: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            lastUsedAt?: string;
        };
        BakeEvent: {
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            ts: string;
            kind: string;
            target?: string;
            status?: string;
            message?: string;
        };
        /** @enum {string} */
        BillingInterval: "monthly" | "annual";
        BillingSummary: {
            trial: {
                active: boolean;
                /**
                 * Format: date-time
                 * @example 2026-05-22T14:23:00.000Z
                 */
                endsAt?: string;
                daysLeft: number;
            };
            /** @description True when the trial has ended and no card is on file. */
            billingRequired: boolean;
            hasPaymentMethod: boolean;
            card?: {
                brand?: string;
                last4?: string;
                expMonth?: number;
                expYear?: number;
            };
            interval: components["schemas"]["BillingInterval"];
            /** @description Total seats = member count (owner included). */
            seatCount: number;
            /** @description Seats included free by the API plan (0 when the plan is inactive). */
            includedSeats: number;
            /** @description Seats actually billed = max(0, seatCount − includedSeats). */
            billableSeats: number;
            /** @description Paid seat ceiling for the current period: seats already billed, kept and swappable within for free. ≥ billableSeats until it resets to the live count at renewal. */
            paidSeats: number;
            unitPricePence: number;
            /** @description Billable seats × unit price, plus the API plan price when active. */
            totalPence: number;
            /** @enum {string} */
            currency: "gbp";
            /** @description True when support has set a custom price on any line for this org. */
            pricingOverridden: boolean;
            /** @description True when every billable line is comped (£0) — nothing to pay. */
            comped: boolean;
            /** @description Stripe subscription status, once converted. */
            status?: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            currentPeriodEnd?: string;
            cancelAtPeriodEnd?: boolean;
            /** @description Standalone API plan; its flat price is included in totalPence when active. */
            apiPlan: {
                active: boolean;
                /** @description API plan price for the current billing interval (monthly or annual). */
                unitPricePence: number;
                /**
                 * Format: date-time
                 * @example 2026-05-22T14:23:00.000Z
                 */
                currentPeriodEnd?: string;
            };
        };
        WebhookEndpoint: {
            endpointId: string;
            /** Format: uri */
            url: string;
            description?: string;
            /** @enum {string} */
            status: "enabled" | "disabled";
            /** @description Subscribed event types, or ['*'] for every type. */
            eventTypes: string[];
            /** @description When true, deliveries are strictly ordered per endpoint (FIFO). */
            ordered: boolean;
            disabledReason?: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            disabledAt?: string;
            consecutiveFailures: number;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
        };
        WebhookDelivery: {
            deliveryId: string;
            /** @description Stable id, sent as the `webhook-id` header and reused verbatim across retries — use it as your idempotency key. */
            webhookId: string;
            endpointId: string;
            eventType: string;
            /** @enum {string} */
            status: "pending" | "delivered" | "failed" | "exhausted";
            attemptCount: number;
            attempts: {
                attemptNo: number;
                /**
                 * Format: date-time
                 * @example 2026-05-22T14:23:00.000Z
                 */
                at: string;
                httpStatus?: number;
                latencyMs?: number;
                error?: string;
            }[];
            nextRetryAt?: number;
            responseSnippet?: string;
            /** @description The exact signed request body. */
            payload: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-05-22T14:23:00.000Z
             */
            updatedAt: string;
        };
    };
    responses: {
        /** @description Missing or invalid credentials. Send an API key (`sk_…`) or Cognito ID token in the `Authorization` header (an optional `Bearer ` prefix is accepted). */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Rate limit exceeded. Limits apply per caller — per API key, per user, and per organization on expensive routes. Wait the number of seconds given in the `Retry-After` header before retrying. */
        RateLimited: {
            headers: {
                /** @description How long to wait before retrying, in whole seconds. */
                "Retry-After"?: number;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listCatalogServices: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of curated, image-based catalog services */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        services: {
                            /** @example postgres */
                            key: string;
                            label: string;
                            description: string;
                            /** @example postgres */
                            image: string;
                            /**
                             * @example [
                             *       "16",
                             *       "15"
                             *     ]
                             */
                            tags: string[];
                            defaultPort: number;
                            dataPath?: string;
                            defaultEnv?: {
                                [key: string]: string;
                            };
                            configSchema: {
                                [key: string]: unknown;
                            };
                            /** @enum {boolean} */
                            trusted: true;
                            /** @example postgresql */
                            logo?: string;
                        }[];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    listCatalogRuntimes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of catalog runtimes with available versions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        runtimes: {
                            key: string;
                            versions: string[];
                            label: string;
                            description: string;
                        }[];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    searchDockerHub: {
        parameters: {
            query: {
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Matching repositories from Docker Hub */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        results: {
                            /** @example grafana/grafana */
                            name: string;
                            description: string;
                            /** @example 500000000 */
                            pullCount: number;
                            /** @example 12000 */
                            starCount: number;
                            /** @description True for Docker Official Images (e.g. postgres, redis). */
                            isOfficial: boolean;
                            isVerifiedPublisher: boolean;
                        }[];
                        /** @description True when the response came from the 30-minute in-process cache. */
                        cached: boolean;
                    };
                };
            };
            /** @description Missing or invalid `q` parameter */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
            /** @description Docker Hub is temporarily unavailable */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listDockerHubTags: {
        parameters: {
            query: {
                image: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Available tags for the requested image */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        tags: {
                            /** @example 11.0.0 */
                            name: string;
                            /** @example 2026-03-15T10:00:00Z */
                            lastUpdated: string;
                        }[];
                        /** @description True when the response came from the 10-minute in-process cache. */
                        cached: boolean;
                    };
                };
            };
            /** @description Missing or invalid `image` parameter */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
            /** @description Docker Hub is temporarily unavailable */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    resolveDockerHubImage: {
        parameters: {
            query: {
                image: string;
                tag: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Resolution outcome. `ok` includes the pinned digest; `not_found` means the tag does not exist; `unsupported` means a non-Hub registry (not checked); `error` means Docker Hub could not be reached right now (retry later). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description `ok` — exists (digest resolved); `not_found` — bad tag; `unsupported` — non-Hub registry, not checked; `error` — transient Hub failure, try again.
                         * @enum {string}
                         */
                        status: "ok" | "not_found" | "unsupported" | "error";
                        /**
                         * @description Pinned digest; present only when status is `ok`.
                         * @example sha256:6f9f…
                         */
                        digest?: string;
                        /** @description True when the result came from the 5-minute in-process cache. Always false for `unsupported` and `error`. */
                        cached: boolean;
                    };
                };
            };
            /** @description Missing or invalid `image`/`tag` parameter */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    getMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Caller identity plus the orgs they belong to */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        user: components["schemas"]["User"];
                        organizations: components["schemas"]["OrgMembershipSummary"][];
                        /** @description True when any of the caller’s orgs enforce MFA. */
                        mfaRequired: boolean;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    getGitSshKey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Key metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        key: {
                            publicKey: string;
                            fingerprint: string;
                            /**
                             * Format: date-time
                             * @example 2026-05-22T14:23:00.000Z
                             */
                            createdAt: string;
                            /**
                             * Format: date-time
                             * @example 2026-05-22T14:23:00.000Z
                             */
                            pushedToGithubAt?: string;
                            githubKeyId?: number;
                        };
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Only the user can read their own SSH key */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description No Git SSH key generated yet */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    generateGitSshKey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description New key generated and pushed to GitHub */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        key: {
                            publicKey: string;
                            fingerprint: string;
                            /**
                             * Format: date-time
                             * @example 2026-05-22T14:23:00.000Z
                             */
                            createdAt: string;
                            /**
                             * Format: date-time
                             * @example 2026-05-22T14:23:00.000Z
                             */
                            pushedToGithubAt?: string;
                            githubKeyId?: number;
                        };
                        replacedPrevious: {
                            fingerprint: string;
                            githubKeyId?: number;
                        } | null;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Only the user can manage their own SSH key */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Organization not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description GitHub not linked for this org, or linked without the write:public_key scope */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
            /** @description GitHub rejected the key */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    revokeGitSshKey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            /** @description Only the user can manage their own SSH key */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    getGithubLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Either an unlinked sentinel or the linked account summary. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        linked: false;
                    } | (components["schemas"]["GithubLink"] & {
                        /** @enum {boolean} */
                        linked: true;
                    });
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    listMyConnections: {
        parameters: {
            query?: {
                provider?: "github";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Linked accounts owned by the caller. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        connections: components["schemas"]["LibraryConnection"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    listOrganizations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Orgs the caller is a member of. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        organizations: components["schemas"]["OrgMembershipSummary"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    createOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateOrgRequest"];
            };
        };
        responses: {
            /** @description Created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        organization: components["schemas"]["Organization"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    getOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Found. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        organization: components["schemas"]["Organization"];
                        /** @description True if any of the org’s AWS connections is behind the current customer-template version. Visible to all members so non-owners know an owner needs to update. */
                        awsUpdateAvailable: boolean;
                        currentConnectionTemplateVersion: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not a member, or no such org. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    deleteOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            /** @description Caller is not an owner. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    updateOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["UpdateOrgRequest"];
            };
        };
        responses: {
            /** @description Updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        organization: components["schemas"]["Organization"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Caller is not an owner. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listMembers: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Members of the organization, including GitHub link summaries. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        members: components["schemas"]["MembershipWithGithub"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    removeMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Cannot remove the last owner. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Forbidden. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Member not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    setMemberPermissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetMemberPermissionsRequest"];
            };
        };
        responses: {
            /** @description Updated membership. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        membership: components["schemas"]["Membership"];
                    };
                };
            };
            /** @description Target is the owner, or an unknown permission was supplied. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Caller is not an owner. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Member not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    transferOwnership: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransferOwnershipRequest"];
            };
        };
        responses: {
            /** @description Ownership transferred. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Target is already the owner. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Caller is not an owner. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Member not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Ownership changed concurrently; retry. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listMemberConnections: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The member’s bindings in this org. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        bindings: components["schemas"]["MemberBinding"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Forbidden. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Member not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    setMemberConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
                provider: "github";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetMemberBindingRequest"];
            };
        };
        responses: {
            /** @description Binding set. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberBinding"];
                };
            };
            /** @description Connection does not belong to you, or provider mismatch. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Only the user can change their own connections. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Member not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    clearMemberConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
                provider: "github";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cleared (idempotent). */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            /** @description Only the user can change their own connections. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listInvites: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owner-only. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        invites: components["schemas"]["Invite"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    createInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateInviteRequest"];
            };
        };
        responses: {
            /** @description Invite created. `emailSent` indicates whether SES accepted the message. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        invite: components["schemas"]["Invite"];
                        /** Format: uri */
                        inviteUrl: string;
                        emailSent: boolean;
                        emailError?: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    revokeInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Revoked. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    previewInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invite preview. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        organization: {
                            orgId: string;
                            name: string;
                        };
                        /** Format: email */
                        email: string;
                        role: components["schemas"]["Role"];
                        /**
                         * Format: date-time
                         * @example 2026-05-22T14:23:00.000Z
                         */
                        expiresAt: string;
                    };
                };
            };
            /** @description Invite not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invite expired. */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    acceptInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description New or existing membership. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        membership: components["schemas"]["Membership"];
                        alreadyMember?: boolean;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Invite email does not match the caller. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invite expired. */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listTemplates: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of templates with a per-template service/project roll-up (no full nested services/projects — fetch a single template for those). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        templates: components["schemas"]["TemplateListItem"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    createTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WriteTemplateBody"];
            };
        };
        responses: {
            /** @description Template created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateWithChildren"];
                };
            };
            /** @description Validation failed — e.g. schema errors, duplicate service/project names, two services publishing the same host port, a registryCredentialId that does not exist in this organisation, or a curated service image tag that does not exist in the registry. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Owner role required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Organization not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    getTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                templateId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Full template */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateWithChildren"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    deleteTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                templateId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Template deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            /** @description Template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    replaceTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                templateId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WriteTemplateBody"];
            };
        };
        responses: {
            /** @description Template updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateWithChildren"];
                };
            };
            /** @description Validation failed — e.g. schema errors, duplicate service/project names, two services publishing the same host port, a registryCredentialId that does not exist in this organisation, or a curated service image tag that does not exist in the registry. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Draft save attempted on an already-published template */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    rebakeTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                templateId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bake re-triggered; template likely now bundle_building */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateWithChildren"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    checkTemplateUpdates: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                templateId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Digest diff report */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckTemplateUpdatesResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    repinTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                templateId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Re-pin result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RepinTemplateServicesResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listEnvironments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of boxes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        environments: components["schemas"]["Environment"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Organization not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    launchEnvironment: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
            };
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LaunchEnvironmentRequest"];
            };
        };
        responses: {
            /** @description Box accepted for launch */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Environment"];
                };
            };
            /** @description Validation failed */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Organization or template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description No active AWS connection, the template is not baked yet, or the Idempotency-Key was already used with a different request body */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    getEnvironment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                envId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Box detail */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Environment"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Environment not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    terminateEnvironment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                envId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Termination requested */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Environment"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not the box launcher or an environments:delete holder */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Environment not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    getEnvironmentMetrics: {
        parameters: {
            query?: {
                range?: "30m" | "1h" | "6h" | "24h" | "48h";
            };
            header?: never;
            path: {
                orgId: string;
                envId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Downsampled metrics time series plus the latest snapshot */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnvironmentMetricsResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Environment not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    stopEnvironment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                envId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stop requested */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Environment"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not the box launcher or an environments:delete holder */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Environment not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Box is terminated or still launching */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    startEnvironment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                envId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Start requested */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Environment"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not the box launcher or an environments:delete holder */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Environment not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Box is terminated or still launching */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    getAutoSleepPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The org policy (or null) plus defaults. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        policy: components["schemas"]["AutoSleepPolicy"] | null;
                        defaults: components["schemas"]["AutoSleepPolicy"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Organization not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    setAutoSleepPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AutoSleepPolicy"];
            };
        };
        responses: {
            /** @description Policy saved. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        policy: components["schemas"]["AutoSleepPolicy"];
                    };
                };
            };
            /** @description Validation failed */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Owner role required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    setTemplateAutoSleep: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                templateId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    autoSleep: components["schemas"]["PartialAutoSleepPolicy"] | null;
                };
            };
        };
        responses: {
            /** @description Override saved. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Template"];
                };
            };
            /** @description Validation failed */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Owner role required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Template not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listOrgAuditEvents: {
        parameters: {
            query?: {
                action?: "create" | "update" | "delete" | "start" | "stop" | "terminate" | "connect" | "bake" | "verify" | "invite" | "remove" | "role_change" | "key_create" | "key_revoke" | "login" | "mfa_enable" | "mfa_disable";
                from?: string;
                to?: string;
                limit?: number;
                cursor?: string;
                userId?: string;
                resourceType?: "environment" | "template" | "member" | "apiKey" | "connection" | "secret" | "org";
                resourceId?: string;
            };
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of audit events */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogResponse"];
                };
            };
            /** @description Invalid filter */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Missing audit:read permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listMyAuditEvents: {
        parameters: {
            query?: {
                action?: "create" | "update" | "delete" | "start" | "stop" | "terminate" | "connect" | "bake" | "verify" | "invite" | "remove" | "role_change" | "key_create" | "key_revoke" | "login" | "mfa_enable" | "mfa_disable";
                from?: string;
                to?: string;
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of audit events */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogResponse"];
                };
            };
            /** @description Invalid filter */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    listApiKeyAuditEvents: {
        parameters: {
            query?: {
                action?: "create" | "update" | "delete" | "start" | "stop" | "terminate" | "connect" | "bake" | "verify" | "invite" | "remove" | "role_change" | "key_create" | "key_revoke" | "login" | "mfa_enable" | "mfa_disable";
                from?: string;
                to?: string;
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                keyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of audit events */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description API key not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listAwsConnections: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All connections for the org. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        currentTemplateVersion: string;
                        connections: components["schemas"]["ConnectionListEntry"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    createAwsConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateConnectionRequest"];
            };
        };
        responses: {
            /** @description Pending connection plus quick-launch setup details. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        connection: components["schemas"]["Connection"];
                        currentTemplateVersion: string;
                        setup: {
                            externalId: string;
                            /** Format: uri */
                            templateUrl: string;
                            /** Format: uri */
                            quickLaunchUrl: string;
                            region: string;
                            templateVersion: string;
                        };
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    getAwsConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                connectionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Connection plus any template-update advice. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        connection: components["schemas"]["Connection"];
                        currentTemplateVersion: string;
                        update: components["schemas"]["ConnectionUpdate"];
                        /** @description Live CloudFormation stack status (e.g. UPDATE_IN_PROGRESS, UPDATE_COMPLETE) when the v9+ template grants DescribeStacks; otherwise absent. */
                        stackStatus?: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    deleteAwsConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                connectionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    verifyAwsConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                connectionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerifyConnectionRequest"];
            };
        };
        responses: {
            /** @description Verified. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        connection: components["schemas"]["Connection"];
                        currentTemplateVersion: string;
                        update: components["schemas"]["ConnectionUpdate"];
                    };
                };
            };
            /** @description Role could not be assumed. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    getAwsConnectionTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CloudFormation template (application/yaml). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["RateLimited"];
        };
    };
    setSecretsConfig: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetSecretsConfigRequest"];
            };
        };
        responses: {
            /** @description Settings saved. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        secretsConfig: components["schemas"]["SecretsConfig"];
                    };
                };
            };
            /** @description Unknown or inactive AWS connection. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Owner role required. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listOrgRepos: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Repos used by the org’s templates. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        repos: components["schemas"]["OrgRepo"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    listEnvConfig: {
        parameters: {
            query?: {
                templateId?: string;
            };
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Config entries plus the org’s secrets backend settings (or null). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        secretsConfig: components["schemas"]["SecretsConfig"] & (Record<string, never> | null);
                        items: components["schemas"]["EnvConfigItem"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    upsertEnvConfig: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpsertEnvConfigRequest"];
            };
        };
        responses: {
            /** @description Saved. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        item: components["schemas"]["EnvConfigItem"];
                    };
                };
            };
            /** @description Validation failed, or no secrets backend configured for a secret. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Owner role required. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    deleteEnvConfig: {
        parameters: {
            query: {
                scope: "org" | "repo" | "template" | "environment";
                kind: "secret" | "variable";
                repoId?: string;
                templateId?: string;
                environmentId?: string;
            };
            header?: never;
            path: {
                orgId: string;
                key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted (idempotent). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        deleted: boolean;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Owner role required. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listRegistryCredentials: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Credentials. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        credentials: components["schemas"]["RegistryCredential"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    createRegistryCredential: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRegistryCredentialRequest"];
            };
        };
        responses: {
            /** @description Created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        credential: components["schemas"]["RegistryCredential"];
                    };
                };
            };
            /** @description Validation failed, or no secrets backend configured. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Caller lacks settings:write. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    deleteRegistryCredential: {
        parameters: {
            query?: {
                force?: "true" | "false";
            };
            header?: never;
            path: {
                orgId: string;
                credentialId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Force-deleted. One or more templates still reference this credential and will fail to bake. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        deleted: true;
                        affectedTemplates: {
                            id: string;
                            name: string;
                        }[];
                    };
                };
            };
            /** @description Deleted. No templates reference this credential. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            /** @description Caller lacks settings:write. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Credential is in use by one or more templates. Delete those references first, or pass `?force=true` to override. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        templates: {
                            id: string;
                            name: string;
                        }[];
                    };
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listRuntimeBundles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of bundles */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        bundles: components["schemas"]["RuntimeBundle"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    listBakeEvents: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                hash: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of events */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        events: components["schemas"]["BakeEvent"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    getBillingSummary: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Billing summary. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BillingSummary"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Caller is not an owner. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Organization not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listWebhookEventTypes: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Available event types with descriptions. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        eventTypes: {
                            type: string;
                            description: string;
                        }[];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    listWebhookEndpoints: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The org’s endpoints. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        endpoints: components["schemas"]["WebhookEndpoint"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    createWebhookEndpoint: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    url: string;
                    description?: string;
                    eventTypes: string[];
                    ordered?: boolean;
                };
            };
        };
        responses: {
            /** @description Created endpoint plus the signing secret (shown once). */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        endpoint: components["schemas"]["WebhookEndpoint"];
                        secret: string;
                    };
                };
            };
            /** @description Invalid URL or event types. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Owner role required. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    getWebhookEndpoint: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        endpoint: components["schemas"]["WebhookEndpoint"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    deleteWebhookEndpoint: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateWebhookEndpoint: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    url?: string;
                    description?: string;
                    eventTypes?: string[];
                    ordered?: boolean;
                    /** @enum {string} */
                    status?: "enabled" | "disabled";
                };
            };
        };
        responses: {
            /** @description Updated endpoint. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        endpoint: components["schemas"]["WebhookEndpoint"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    getWebhookSecret: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The current secret. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        secret: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    rollWebhookSecret: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    expireOld?: boolean;
                };
            };
        };
        responses: {
            /** @description The new secret (shown once) and the overlap window. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        secret: string;
                        overlapSeconds: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    pingWebhookEndpoint: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Enqueued test delivery. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        webhookId: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listWebhookDeliveries: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of deliveries plus an opaque cursor. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        deliveries: components["schemas"]["WebhookDelivery"][];
                        cursor?: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["RateLimited"];
        };
    };
    getWebhookDelivery: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
                deliveryId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The delivery. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        delivery: components["schemas"]["WebhookDelivery"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    redeliverWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                endpointId: string;
                deliveryId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Enqueued replay. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        webhookId: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description Not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
}
