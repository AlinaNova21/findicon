#!/usr/local/bin/node
const argv = process.argv.slice(2)
require('./')(...argv).then(ret=>console.log(ret))