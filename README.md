![Logo](admin/home_controller_backend.png)
# ioBroker.home_controller_backend

[![NPM version](https://img.shields.io/npm/v/iobroker.home_controller_backend.svg)](https://www.npmjs.com/package/iobroker.home_controller_backend)
[![Downloads](https://img.shields.io/npm/dm/iobroker.home_controller_backend.svg)](https://www.npmjs.com/package/iobroker.home_controller_backend)
![Number of Installations](https://iobroker.live/badges/home_controller_backend-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/home_controller_backend-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.home_controller_backend.png?downloads=true)](https://nodei.co/npm/iobroker.home_controller_backend/)

**Tests:** ![Test and Release](https://github.com/jkuenemund/ioBroker.home_controller_backend/workflows/Test%20and%20Release/badge.svg)

## home_controller_backend adapter for ioBroker

Backend adapter for the Home Controller system. Provides device management and WebSocket communication for the Home Controller mobile app.

### Features

- **Device Management**: Read and manage device configurations from `0_userdata.0.home_controller`
- **Admin UI**: Two separate interfaces for different purposes
  - **Adapter Configuration** (`index_m.html`): React-based settings interface
  - **Sidebar Tab** (`tab_m.html`): Standalone management interface accessible from the ioBroker sidebar
- **WebSocket Server**: Echtzeit-Kommunikation mit Token-Auth (Bearer/JWT-ähnlich) und optional TLS (`wss://`)
- **Compatibility Mode**: Works with existing device configurations

### Admin UI Pages

This adapter provides two separate admin interfaces:

#### 1. Adapter Configuration (`index_m.html`)
- **Location**: Instances → home_controller_backend → Configuration (wrench icon)
- **Technology**: React with Material-UI
- **Purpose**: Configure adapter settings
- **Features**:
  - Settings tab: Configure `basePath` and other adapter options
  - Devices tab: View devices from the configured path (read-only)

#### 2. Sidebar Tab (`tab_m.html`)
- **Location**: Left sidebar → "Home Controller" (house icon)
- **Technology**: Standalone HTML/CSS/JavaScript
- **Purpose**: Quick access to device management
- **Features**:
  - Real-time connection status
  - Device overview and management (planned)
  - Direct access without navigating to adapter settings

### Authentication & TLS
- Default auth mode is **token**: the adapter verifies signed tokens using the ioBroker `system.config.native.secret`.
- Clients can obtain a token via `POST /token` on the WebSocket port (JSON: `{ "username": "<iob-user>", "password": "<pass>", "ttlSeconds": 3600 }`). Response: `{ "token": "...", "expiresAt": 1700000000 }`.
- Clients present the token via `Authorization: Bearer <token>` or `?token=<token>` during the WebSocket upgrade.
- Optional static token: paste a pre-generated signed token into the adapter config for headless clients.
- TLS (`wss://`) is optional; enable it only if you terminate TLS inside the adapter. Behind VPN or reverse proxy `ws://` is sufficient.

## Developer manual
This section is intended for the developer. It can be deleted later.

### DISCLAIMER

Please make sure that you consider copyrights and trademarks when you use names or logos of a company and add a disclaimer to your README.
You can check other adapters for examples or ask in the developer community. Using a name or logo of a company without permission may cause legal problems for you.

### Getting started

You are almost done, only a few steps left:
1. Create a new repository on GitHub with the name `ioBroker.home_controller_backend`
1. Initialize the current folder as a new git repository:  
	```bash
	git init -b main
	git add .
	git commit -m "Initial commit"
	```
1. Link your local repository with the one on GitHub:  
	```bash
	git remote add origin https://github.com/jkuenemund/ioBroker.home_controller_backend
	```

1. Push all files to the GitHub repo:  
	```bash
	git push origin main
	```
1. Add a new secret under https://github.com/jkuenemund/ioBroker.home_controller_backend/settings/secrets. It must be named `AUTO_MERGE_TOKEN` and contain a personal access token with push access to the repository, e.g. yours. You can create a new token under https://github.com/settings/tokens.

1. Head over to [src/main.ts](src/main.ts) and start programming!

### Best Practices
We've collected some [best practices](https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices) regarding ioBroker development and coding in general. If you're new to ioBroker or Node.js, you should
check them out. If you're already experienced, you should also take a look at them - you might learn something new :)

### State Roles
When creating state objects, it is important to use the correct role for the state. The role defines how the state should be interpreted by visualizations and other adapters. For a list of available roles and their meanings, please refer to the [state roles documentation](https://www.iobroker.net/#en/documentation/dev/stateroles.md).

**Important:** Do not invent your own custom role names. If you need a role that is not part of the official list, please contact the ioBroker developer community for guidance and discussion about adding new roles.

### Scripts in `package.json`
Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `build` | Compile the TypeScript and React sources. |
| `watch` | Compile the TypeScript and React sources and watch for changes. |
| `build:ts` | Compile the TypeScript sources. |
| `watch:ts` | Compile the TypeScript sources and watch for changes. |
| `build:react` | Compile the React sources. |
| `watch:react` | Compile the React sources and watch for changes. |
| `test:ts` | Executes the tests you defined in `*.test.ts` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |
| `translate` | Translates texts in your adapter to all required languages, see [`@iobroker/adapter-dev`](https://github.com/ioBroker/adapter-dev#manage-translations) for more details. |
| `release` | Creates a new release, see [`@alcalzone/release-script`](https://github.com/AlCalzone/release-script#usage) for more details. |

### Configuring the compilation
The adapter template uses [esbuild](https://esbuild.github.io/) to compile TypeScript and/or React code. You can configure many compilation settings 
either in `tsconfig.json` or by changing options for the build tasks. These options are described in detail in the
[`@iobroker/adapter-dev` documentation](https://github.com/ioBroker/adapter-dev#compile-adapter-files).

### Writing tests
When done right, testing code is invaluable, because it gives you the 
confidence to change your code while knowing exactly if and when 
something breaks. A good read on the topic of test-driven development 
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92. 
Although writing tests before the code might seem strange at first, but it has very 
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter
Using GitHub Actions, you can enable automatic releases on npm whenever you push a new git tag that matches the form 
`v<major>.<minor>.<patch>`. We **strongly recommend** that you do. The necessary steps are described in `.github/workflows/test-and-release.yml`.

Since you installed the release script, you can create a new
release simply by calling:
```bash
npm run release
```
Additional command line options for the release script are explained in the
[release-script documentation](https://github.com/AlCalzone/release-script#command-line).

To get your adapter released in ioBroker, please refer to the documentation 
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Starting the Dev Server
Since you set up `dev-server`, you can use it to run, test and debug your adapter locally.

You may start `dev-server` by calling:
```bash
npm run dev-server watch
```

The ioBroker.admin interface will then be available at http://localhost:8081/

Please refer to the [`dev-server` documentation](https://github.com/ioBroker/dev-server#command-line) for more details.

## Changelog
### 0.0.2-beta.0 (2025-12-12)
* fix lint errors

### 0.0.2-alpha.0 (2025-12-12)
* (prof) add token-based WebSocket auth, optional TLS, and `/token` issuance endpoint

## License
MIT License

Copyright (c) 2025 prof <jens.kuenemund@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.