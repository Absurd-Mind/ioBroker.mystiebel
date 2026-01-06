![Logo](admin/mystiebel.png)
# ioBroker.mystiebel

[![NPM version](https://img.shields.io/npm/v/iobroker.mystiebel.svg)](https://www.npmjs.com/package/iobroker.mystiebel)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mystiebel.svg)](https://www.npmjs.com/package/iobroker.mystiebel)
![Number of Installations](https://iobroker.live/badges/mystiebel-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/mystiebel-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.mystiebel.png?downloads=true)](https://nodei.co/npm/iobroker.mystiebel/)

**Tests:** ![Test and Release](https://github.com/Absurd-Mind/ioBroker.mystiebel/workflows/Test%20and%20Release/badge.svg)

## MyStiebel Adapter for ioBroker

This adapter connects ioBroker with Stiebel Eltron heat pumps via the MyStiebel Cloud API (https://www.mystiebel.com/).
It allows you to monitor sensors and control parameters of your heat pump directly from ioBroker.

**Note:** This adapter requires the device to be connected to the MyStiebel Cloud (usually via an Internet Service Gateway - ISG).

### Supported Hardware
* Stiebel Eltron Heat Pumps compatible with MyStiebel App.
* Tested with:
    * WWK 300 Electronic
    * (Add other known supported models here as users report them)

## Configuration
1.  **Username**: Your MyStiebel account email address.
2.  **Password**: Your MyStiebel account password.
3.  **Client ID**: A unique identifier for this adapter instance. You can usually leave this as generated, or set a custom one if you want to track specific "apps" in your Stiebel account.

### How to get credentials
You need to register an account at [MyStiebel](https://www.mystiebel.com/) and pair your device there first. Use the same credentials in this adapter.

## Features
*   **Authentication**: Secure login using JWT (tokens are kept in memory, not stored in database).
*   **Real-time Monitoring**: Subscribes to changes via WebSocket.
*   **Controls**:
    *   Set Comfort/Eco temperatures.
    *   Boost Request.
    *   Hot Water Plus.
    *   Eco Heating Mode.
*   **Sensors**:
    *   Temperatures (Dome, Target).
    *   Water Volume.
    *   Operating Mode.
    *   Status indicators (Compressor, Defrosting, etc.).

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 0.0.1 (2026-01-05)
* (Absurd-Mind) Initial release.
* (Absurd-Mind) Added WebSocket support.
* (Absurd-Mind) Added basic controls and sensors.

## License
Apache-2.0

Copyright (c) 2026 Absurd-Mind <github@myref.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
