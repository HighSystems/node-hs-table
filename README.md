@highsystems/table
==================

[![npm license](https://img.shields.io/npm/l/@highsystems/table.svg)](https://www.npmjs.com/package/@highsystems/table) [![npm version](https://img.shields.io/npm/v/@highsystems/table.svg)](https://www.npmjs.com/package/@highsystems/table) [![npm downloads](https://img.shields.io/npm/dm/@highsystems/table.svg)](https://www.npmjs.com/package/@highsystems/table)

A lightweight, promise based abstraction layer for High Systems Tables

Written in TypeScript, targets Nodejs and the Browser

Install
-------
```
# Install
$ npm install @highsystems/table
```

Documentation
-------------

[TypeDoc Documentation](https://highsystems.github.io/node-hs-table/)

Server-Side Example
-------------------
```typescript
import { HSTable } from '@highsystems/table';
import { HighSystems } from '@highsystems/client';

const highsystems = new HighSystems({
    instance: 'www',
    userToken: 'xxx'
});

const qbTable = new QBTable({
	highsystems: highsystems,
    applicationId: 'xxxxxxxxx',
	tableId: 'xxxxxxxxx',
    fids: {
        name: 'xxxxx'
    }
});

(async () => {
    try {
        const results = await qbTable.load();

        console.log(results);
    }catch(err){
        console.error(err);
    }
})();
```

Client-Side Example
-------------------
Import `QBTable` by loading `@highsystems/table.browserify.min.js`

```javascript
var highsystems = new QuickBase({
    realm: 'www'
});

var qbTable = new QBTable({
	highsystems: highsystems,
    applicationId: 'xxxxxxxxx',
	tableId: 'xxxxxxxxx',
    fids: {
        name: 6
    }
});

qbTable.load().then(function(results){
    console.log(results);
}).catch(function(err){
    console.error(err);
});
```

License
-------
Copyright 2023 High Systems, Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
