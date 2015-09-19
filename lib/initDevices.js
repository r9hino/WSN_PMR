// Initialize devices to preview state.
// Turn on/off devices, depending on system state.

function initDevices(jsonSystemState, bbb, xbee){
    console.log('Start devices initialization...');

    // Restore devices to last state.
    for(var devId in jsonSystemState){
        // If device is connected to an xbee module:
        if(jsonSystemState[devId].type === 'xbee'){
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
    