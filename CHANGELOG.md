# [1.19.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.18.0...v1.19.0) (2026-11-14)


### Features

* screenshots of the app on the home page, download page and README ([0cfbcb6](https://github.com/SebastianFoder/fm-scoutreporter/commit/0cfbcb68697368405c40c6059a5c577d1779815b))

# [1.18.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.17.2...v1.18.0) (2026-11-13)


### Bug Fixes

* **desktop:** keep weights, highlights and formations between launches ([3ee1db5](https://github.com/SebastianFoder/fm-scoutreporter/commit/3ee1db534ad11accd35efe7db2f25643c69cb305))


### Features

* **desktop:** tell you about new versions and update in one click ([8b71fbe](https://github.com/SebastianFoder/fm-scoutreporter/commit/8b71fbe1f85082ab6a0ed0a568077bda9d3ba508))

## [1.17.2](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.17.1...v1.17.2) (2026-11-13)


### Bug Fixes

* **download:** link to the desktop releases and show a new one within 10 minutes ([79c08a1](https://github.com/SebastianFoder/fm-scoutreporter/commit/79c08a1387ee96899d30a3b5263d8e10ed288da6))

## [1.17.1](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.17.0...v1.17.1) (2026-11-13)


### Performance Improvements

* **reader:** open FM's memory faster ([4172a6e](https://github.com/SebastianFoder/fm-scoutreporter/commit/4172a6e706e6bd9ad3e4d49f6a4a91223eeaadc5))
* **reader:** read clubs' squads in parallel ([a1fe6e6](https://github.com/SebastianFoder/fm-scoutreporter/commit/a1fe6e660c65b1f7a3b116d50ef2560df87b2655))
* **reader:** read memory a page at a time when reading people ([7ebde00](https://github.com/SebastianFoder/fm-scoutreporter/commit/7ebde0060bd00d5ebb1e3194ffd1472c1859b9dc))
* **reader:** read only the people a search scan keeps ([d1c6a2c](https://github.com/SebastianFoder/fm-scoutreporter/commit/d1c6a2cd51d557158345c7f314a659dc054dd5d8))
* **reader:** share the scan pass's memory pieces between workers ([83c9478](https://github.com/SebastianFoder/fm-scoutreporter/commit/83c9478e35c4e79ed229b9ad9286e95939692eb2))
* **reader:** time each scan step and split finding people from reading them ([e14a256](https://github.com/SebastianFoder/fm-scoutreporter/commit/e14a256ba60ba12443a3ded5ce1c60d805d96adc))

# [1.17.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.16.0...v1.17.0) (2026-11-13)


### Features

* publish the desktop app as GitHub Releases and add a download page ([ad7c1da](https://github.com/SebastianFoder/fm-scoutreporter/commit/ad7c1da1d3426ed569de936fc4d9c154440b32ba))

# [1.16.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.15.0...v1.16.0) (2026-11-13)


### Features

* open players in a side panel and show their value in the player list ([c08f6a7](https://github.com/SebastianFoder/fm-scoutreporter/commit/c08f6a704c83c352fd121dd36aa835c144310aa4))

# [1.15.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.14.0...v1.15.0) (2026-11-13)


### Features

* **desktop:** use the Scout Reporter icon instead of Electron's ([f2038ad](https://github.com/SebastianFoder/fm-scoutreporter/commit/f2038adb881b741726dd8d763269091ee23a9ddd))

# [1.14.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.13.0...v1.14.0) (2026-11-13)


### Bug Fixes

* **desktop:** honour Hide CA/PA when a scan is used before settings load ([0836614](https://github.com/SebastianFoder/fm-scoutreporter/commit/083661402da86a9cdf1d369d81d89e6f5b452578))


### Features

* **desktop:** add the Electron desktop app for Windows ([0aba791](https://github.com/SebastianFoder/fm-scoutreporter/commit/0aba7918f9f1b53ea39d6e9059b8b5e71f7f5aec))
* **desktop:** make a scan an export of your FM search, with a hidden attributes switch ([2c5b921](https://github.com/SebastianFoder/fm-scoutreporter/commit/2c5b92170fda2ff14cce0609a8e2974c91cbb5e8))
* **desktop:** read FM's own search result, to load only players who would join ([62bd2eb](https://github.com/SebastianFoder/fm-scoutreporter/commit/62bd2eb7742b3da831dd35eb5645e9b1ac157091))
* **desktop:** store scans in SQLite and load only what the screens need ([fb0cee6](https://github.com/SebastianFoder/fm-scoutreporter/commit/fb0cee60d1a2cd39203a02c0cb64482cad6f83ab))
* keep imports in IndexedDB so full-database imports fit ([4c2233d](https://github.com/SebastianFoder/fm-scoutreporter/commit/4c2233d83f2ea5301051c86972a1f53c6e83971c))
* **reader:** add the Windows memory reader, adapted from FMSuperScout ([55ea9a4](https://github.com/SebastianFoder/fm-scoutreporter/commit/55ea9a4413e67822f10bdc56958aa20bce393ed5))

# [1.13.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.12.0...v1.13.0) (2026-11-11)


### Features

* **staff:** lock in and remove backroom picks ([32f062c](https://github.com/SebastianFoder/fm-scoutreporter/commit/32f062c77a1da26d74659d263dce53e8673cd95c))

# [1.12.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.11.0...v1.12.0) (2026-11-11)


### Features

* **squad:** add squad analysis and fm-style formation editor ([0f097c9](https://github.com/SebastianFoder/fm-scoutreporter/commit/0f097c9e294405707589b82ce3536d7e8f1e202f))

# [1.11.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.10.0...v1.11.0) (2026-11-11)


### Features

* **staff:** add staff mode and best backroom ([ad3d21e](https://github.com/SebastianFoder/fm-scoutreporter/commit/ad3d21e930d4694d0dec720bed38b9cb5cf9187d))

# [1.10.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.9.0...v1.10.0) (2026-11-11)


### Features

* **seo:** add site metadata, sitemap, share card and faq page ([940fd76](https://github.com/SebastianFoder/fm-scoutreporter/commit/940fd7673b0d8a68fc185c5b575adbe3eea98467))

# [1.9.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.8.0...v1.9.0) (2026-11-11)


### Features

* **grades:** give grade stamps gloss, inner glow and a moving fill ([3dc6beb](https://github.com/SebastianFoder/fm-scoutreporter/commit/3dc6beb847152d163a5c11d45c6327f5a17bc44a))

# [1.8.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.7.0...v1.8.0) (2026-11-11)


### Features

* **grades:** add s++ to f grade stamps on players ([4e9e76c](https://github.com/SebastianFoder/fm-scoutreporter/commit/4e9e76cf592c33c55e319db279245985da76aaf9))
* **potential:** ground growth in fm27 training data and add development plan ([aa6ceef](https://github.com/SebastianFoder/fm-scoutreporter/commit/aa6ceef2f25964b81f97979b0d26127f6ebc2b56))

# [1.7.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.6.0...v1.7.0) (2026-11-10)


### Features

* **views:** rename v1/v2 views to Standard and Hidden Attributes ([fbddba0](https://github.com/SebastianFoder/fm-scoutreporter/commit/fbddba098cb39f562dc88213108fcd7f8eff00b0))

# [1.6.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.5.0...v1.6.0) (2026-11-10)


### Features

* **best-xi:** add best eleven picker with formation and budget limits ([c5a6164](https://github.com/SebastianFoder/fm-scoutreporter/commit/c5a6164a2d4850b8176645865cc59f1217de067f))

# [1.5.0](https://github.com/SebastianFoder/fm-scoutreporter/compare/v1.4.2...v1.5.0) (2026-11-10)


### Features

* add FM27 benchmark profiles and wonderkid mode ([04b1f04](https://github.com/SebastianFoder/fm-scoutreporter/commit/04b1f040d7089d66c7fbc435eaa910aa3493bf90))
* **ui:** redesign the interface as a data-first scouting tool ([3f3c17c](https://github.com/SebastianFoder/fm-scoutreporter/commit/3f3c17c2af361a42d2f79bb7a43d3f357b9a5419))

## [1.4.2](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.4.1...v1.4.2) (2026-11-10)


### Bug Fixes

* **parser:** support comma-delimited FM27 exports ([192402a](https://github.com/SebastianFoder/fm26-scoutreporter/commit/192402af50d2d455ee5f00c0838aef17be263c25))

## [1.4.1](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.4.0...v1.4.1) (2026-04-10)


### Bug Fixes

* **mustermann:** filter defend/support/create/score by card percentiles ([c614baf](https://github.com/SebastianFoder/fm26-scoutreporter/commit/c614baffe0506694cd17d0e4e0a6b782ef7feb0f))

# [1.4.0](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.3.1...v1.4.0) (2026-04-10)


### Features

* **app:** add mustermann mode and expand stat import support ([e7713d0](https://github.com/SebastianFoder/fm26-scoutreporter/commit/e7713d05932de2127ba0aaa3e2038f3a360fcb92))

## [1.3.1](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.3.0...v1.3.1) (2026-04-09)


### Bug Fixes

* **moneyball:** handle null stored weights in migrateWeightsProfile ([4686f79](https://github.com/SebastianFoder/fm26-scoutreporter/commit/4686f79813c15b97ae675dacfbe15ac532855dfa))

# [1.3.0](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.2.1...v1.3.0) (2026-04-09)


### Features

* **app:** add moneyball and attribute modes ([3f3ab7b](https://github.com/SebastianFoder/fm26-scoutreporter/commit/3f3ab7b963f248eeb1161dc1a3c2ce55f5b4713f))

## [1.2.1](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.2.0...v1.2.1) (2026-04-05)


### Bug Fixes

* **players:** preserve scroll and clamp page on list URL updates ([faafb89](https://github.com/SebastianFoder/fm26-scoutreporter/commit/faafb890ab0d52266957a5f9017c282e74baee6f))

# [1.2.0](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.1.0...v1.2.0) (2026-04-05)


### Features

* **players:** add debounced name search with shareable q param ([407ed1d](https://github.com/SebastianFoder/fm26-scoutreporter/commit/407ed1da1978bb97a4f0f7e72ab0345a0ff55267))

# [1.1.0](https://github.com/SebastianFoder/fm26-scoutreporter/compare/v1.0.0...v1.1.0) (2026-04-05)


### Features

* **ui:** align app with neo-brutalist design system ([542cac7](https://github.com/SebastianFoder/fm26-scoutreporter/commit/542cac70098636a3d36d3bae1036c9bbbf7959a9))

# 1.0.0 (2026-04-05)


### Features

* improve players and compare flows; add semantic release ([8cc87f4](https://github.com/SebastianFoder/fm26-scoutreporter/commit/8cc87f409197cbced7e0413dbaac9445ad190729))
