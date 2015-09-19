// Initialize devices to preview state.
// Turn on/off devices, depending on system state.

function initDevices(jsonSystemState, bbb, xbee){
    console.log('Start devices initialization...');
    // Configure pins as input or output
    bbb.pinMode(jsonSystemState["dev0"].pin, bbb.OUTPUT);
    bbb.pinMode(jsonSystemState["dev1"].pin, bbb.OUTPUT);

    // Restore devices to last state.
    for(var devId in jsonSystemState){
        // If device is connected to Beaglebone pin:
        if(jsonSystemState[devId].type === 'pin'){
            console.log('   Setting up '+jsonSystemState[devId].name+' state.');
            bbb.digitalWrite(jsonSystemState[devId].pin, jsonSystemState[devId].switchValue);
        }
        // If device is connected to an xbee module:
        else if(jsonSystemState[devId].type === 'xbee'){
            if(jsonSystemState[devId].switchValue === 1) 
                xbee.remoteATCmdReq(jsonSystemState[devId].xbee, null, 'D4', xbee.C.PIN_MODE.D4.DIGITAL_OUTPUT_HIGH);
            else 
                xbee.remoteATCmdReq(jsonSystemState[devId].xbee, null, 'D4', xbee.C.PIN_MODE.D4.DIGITAL_OUTPUT_LOW);
            
            console.log('   Setting up ' + jsonSystemState[devId].name + ' state.');
        }
    }
    console.log("Devices initialization complete.");
}

module.exports = initDevices;
    