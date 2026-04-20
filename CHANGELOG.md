# Changelog

## [1.1.0](https://github.com/ASRagab/cursor-agents-sdk-ts/compare/v1.0.0...v1.1.0) (2026-04-20)


### Features

* Add read-only live contract verification script (scripts/verify-c… ([7812b20](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/7812b208a5615d451a7592d9f8fc4ec5feabba3e))
* Updated CLI human output to show promoted agent fields and print… ([ae4a18c](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/ae4a18c861712540346dd6df92ea89a6f67085bf))
* Updated the cursor-agents CLI skill to use placeholder model IDs,… ([6189d97](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/6189d979dbc43231e15e6f732c38fe4a870240ad))


### Bug Fixes

* Fixed CLI watch JSON streaming so both watch modes emit streamed m… ([a0ff989](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/a0ff98994767191eb8fa8437cbeb98e811ae2a58))
* use Basic auth in verify scripts to match SDK ([cc5426d](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/cc5426da5420c3bf247a569793658f6a53ce2fa7))

## [1.0.0](https://github.com/ASRagab/cursor-agents-sdk-ts/compare/v0.2.0...v1.0.0) (2026-04-12)


### ⚠ BREAKING CHANGES

* Repository.url is renamed to Repository.repository to match the API response field. Code that reads repositories[i].url must be updated.

### Features

* sync SDK with latest Cursor Cloud Agents API docs ([df6a173](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/df6a1732f84a87b99a4f7ce4693daf83e9818abb))

## 0.2.0 (2026-04-02)


### Features

* add integration tests, README, and polish ([475857a](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/475857afe9e30fda41ca021d2abebc90029a87fa))
* implement CLI with Commander — all commands, prompt-file, image, watch ([ee589a9](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/ee589a994093a3db86e30fe8f53862571be0039e))
* implement SDK core — schemas, client, agents, artifacts ([68682c7](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/68682c773f614a56d109c39c8abaa8724c802a22))
* **publishing:** adding license and setup npm ([4518b2d](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/4518b2d00327c66c9d50380690a20d432dfd2ac8))
* **publishing:** adding license and setup npm ([73c8587](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/73c8587135d668cf637ef338e36c626ce35139d1))


### Bug Fixes

* add missing Prompt and Source type re-exports ([677204b](https://github.com/ASRagab/cursor-agents-sdk-ts/commit/677204b606798246e8fedca0889d34021b4e4275))
