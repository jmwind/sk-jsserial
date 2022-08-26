import SkClient from 'sk-jsclient/sk-client';
import { SkConversions, SkData, SkPolars, CATALINA_36_POLARS } from 'sk-jsclient/sk-data'
import WebSocket from 'ws';
import { SerialPort } from 'serialport'

let state = SkData.newMetrics();
let g1_val = 0;

const port = new SerialPort({
    path: '/dev/serial0',
    baudRate: 9600,
}, (err) => {
    if (err) {
        console.log("error opening serial port");
        process.exit(1);
    }
});

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function encode(str) {
    var arr = [];
    for (var i = 0, l = str.length; i < l; i++) {
        var ascii = str.charCodeAt(i);
        arr.push(ascii);
    }
    arr.push(255);
    arr.push(255);
    arr.push(255);
    return Buffer.from(arr);
}

function echoSerial(msg, fn) {
    let aws = state[SkData.AWS];
    let awa = state[SkData.AWA];
    let sog = state[SkData.SOG];
    let polar_ratio = state[SkData.POLAR_RATIO].value;
    let aws_val = SkConversions.fromMetric(aws).toFixed(1);
    let awa_val = SkConversions.fromMetric(awa).toFixed(0);
    let sog_val = SkConversions.fromMetric(sog).toFixed(1);
    // this normalizes into a range. The * is the height of the waveform from 
    // Nextrion and the 35kn the max wind range
    let aws_norm = ((aws_val / 35) * 77).toFixed(0);
    let lmiddle = encode(`lmiddle.txt="${aws_val}"`);
    let rtop = encode(`rtop.txt="${awa_val}"`);
    let rbottom = encode(`rbottom.txt="${sog_val}"`);
    let g1 = encode(`g1.val=${polar_ratio}`);
    let g1t = encode(`g1t.txt="${polar_ratio.toFixed(0)}%"`);
    let wave = encode(`add 15,0,${aws_norm}`);
    let wave2 = encode(`add 15,1,${aws_norm}+1`);
    let wave3 = encode(`add 15,2,${aws_norm}-1`);
    let wave4 = encode(`add 15,3,${aws_norm}-1`);

    port.write(lmiddle);
    port.write(rtop);
    port.write(rbottom);
    port.write(g1);
    port.write(g1t);
    port.write(wave);
    port.write(wave2);
    port.write(wave3);
    port.write(wave4);
    console.log(`sent... ${lmiddle}`);
}

function dumpMetrics() {
    const client = new SkClient((url) => { return new WebSocket(url) });
    client.setState(state);
    let polars = SkPolars.readFromFileContents(CATALINA_36_POLARS);
    client.setPolars(polars);
    client.on('delta', echoSerial);
    client.connect();

    sleep(180000).then(() => {
        client.off('delta');
        client.disconnect();
    });
}

// ################################################
// MAIN 
// ################################################

dumpMetrics();

