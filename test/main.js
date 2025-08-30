import { printMessage } from "../src/bmssp.mjs";

function testFunction() {
    try {
        const result = printMessage("Hello, World!");
        console.log('Test passed:', result);
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testFunction();
