/*
    This module will store:
        - Initial configuration for xbee and serial port.
        - Xbee modules addresses.
        - All functions framework based on xbee-api module.
*/

var xbeeLog = require('debug')('xbee');

// Private variables.
var xbeeAddr64 = {
    "xb0": '0013a20040afb72d',
    "xb1": '0013a20040b32d72', 
    "xb2": '0013a20040b32d6c'
};
var xbeeAddr16 = {};        // Store xbee 16 bit addresses. {"xb0": '0000', "xb1": 'fffe', ...}
var nodesDiscovered = {};   // Store which nodes have been discovered. {"xb0": false, "xb1": false, ....}
var networkRoutes = {};     // Store routes for each module. {"xb1": [], "xb2": [], ...}


// Constructor High-Level Framework for Xbee.
// Inputs: 
//      serialport: Object instance of serialport.
//      xbeeAPi: Low-Level Framework instance.
//      xbeeAdd64: Object with xbee 64bit addresses. {"xb0": '0013a20040b08958', "xb1": '0013a20040b82646'}.
//      constants: Xbee ZigBee constants.
function Xbee(serialport, xbeeAPI, constants){
    // Clear serialport read buffer.
    serialport.open(function(error){
        if(error) return console.error("Error opening serialport - " + error);
        serialport.flush(function(err){
            if(err) return console.error("Error flushing read buffer from serialport - " + err);
        });
    });
    
    this.serialport = serialport;
    this.xbeeAPI = xbeeAPI;

    // xbee-api constants.
    this.C = constants;

    // Store xbee sensor data.
    this.sensorData = {
        'xb1': {tempAccum: 0, sampleNum: 0},
        'xb2': {tempAccum: 0, sampleNum: 0},
    };
    
    this.nodesNotDiscovered = [];    // Store all devices that could not be discovered by ND broadcasting.
    
    // Initialize to default: 16 bit addresses, nodes discovered, network routes.
    for(var xbeeKey in xbeeAddr64){
        if(xbeeKey === "xb0"){
            xbeeAddr16[xbeeKey] = '0000';
            nodesDiscovered[xbeeKey] = false;
        }
        else{
            xbeeAddr16[xbeeKey] = 'fffe';
            nodesDiscovered[xbeeKey] = false;
            networkRoutes[xbeeKey] = [];
        }
    }
}

// Do a Node Discovery. This will help retrieving xbee 16 bit addresses not routes.
// 1. Send broadcast signal with ND (Node Discovery) command.
// 2. Wait for responses of each modules.
// 3. Were all xbee found?
//      - Yes: Good, we finish.
//      - No: Number of attempts is less than the defined?
//          - Yes: Repeat from 1.
//          - No: Bad, not all modules were found. Finish.
Xbee.prototype.WSNNodeDiscovery = function(NDCallback){
    var xbeeAPI = this.xbeeAPI;
    var that = this;
    var countNodesDiscovered = 0;
    var totalNodes = Object.keys(xbeeAddr64).length;   // Total xbee devices or nodes.
    var maxTimeWait = 8000;    // Max time waiting for discover all nodes.
    // If not all node were discover in a maxTimeWait ms, the system will repeat # times the ND broadcasting signal.
    var totalNDTry = 1;
    var countNDTry = 0;   // Count actual try broadcasting ND signal.
    var NDTimeout;  // Store setInterval() object so then we can use clearInterval().
    
    console.log('Start WSN nodes discovery...');
    console.log('Number of nodes to discover: ' + totalNodes);
    
    nodeDiscoveryHandler();
    
    function nodeDiscoveryHandler(){
        that.remoteATCmdReq('broadcast', null, 'ND', '');   // Discover every node in the xbee network and store the 16bit address.

        // Attach rxCallback and wait for the deferred response.
        xbeeAPI.on("frame_object", rxCallback);            
        function rxCallback(receivedFrame){
            var xbeeKey = that.getXbeeKeyByAddress64(receivedFrame.remote64);
            var cmd = receivedFrame.command;

            // If command from Remote AT Command Response frame is 'ND', proceed.
            if(cmd === 'nd' || cmd === 'ND'){
                //console.log('ND inside nodeDiscoveryHandler');
                if(nodesDiscovered[xbeeKey] === false){
                    nodesDiscovered[xbeeKey] = true;
                    countNodesDiscovered++;
                    xbeeAddr16[xbeeKey] = receivedFrame.remote16;   // Save 16bit address.
                    console.log('   ' + xbeeKey + ' found. Number of nodes discovered: ' + countNodesDiscovered + '/' + totalNodes);
                }
                // When all node have been discovered, search is complete.
                if(totalNodes === countNodesDiscovered){
                    xbeeAPI.removeListener("frame_object", rxCallback);   // xbeeAPI.on() will stop listening.
                    clearInterval(NDTimeout);
                    return NDCallback(null);
                }
            }
        };

        NDTimeout = setInterval(nodeDiscoveryRepeater, maxTimeWait);
        function nodeDiscoveryRepeater(){
            // Stop trying to discover all node in the network after 'totalNDTry' times.
            if(countNDTry === totalNDTry){
                xbeeAPI.removeListener("frame_object", rxCallback);   // xbeeAPI.on() will stop listening.
                clearInterval(NDTimeout);
                return NDCallback(new Error('Could not discover all nodes in the network.'));
            }
            
            console.log('   Retry ND broadcasting.');
            // Keep trying to discover all nodes in the network.
            that.remoteATCmdReq('broadcast', null, 'ND', '');   // Retry ND broadcasting.
            countNDTry++;
        }
    }
}


//******************************************************************************
// Functions for transmiting API frames.

// AT Command Request 0x08. In this case is the coordinator who will receive the command.
Xbee.prototype.ATCmdReq = function(frameId, cmd, cmdParameter){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.AT_COMMAND, // 0x08
        command: cmd
    }
    // If an id frame was explicitly pass as parameter then use it.  
    if(frameId !== null){
        frame_obj.id = frameId;
    }
    // Do not create frame_obj.commandParameter key when cmdParameter is empty, this way
    // xbeeAPI.buildFrame() will interpret it as a remote AT command with no parameter.
    if((cmdParameter !== '') && (cmdParameter !== undefined) && (cmdParameter !== null)){
        frame_obj.commandParameter = [cmdParameter];
    }
    
    serialport.open(function(error){
        if(error)   return console.error("AT Command Request - " + error);
        serialport.write(xbeeAPI.buildFrame(frame_obj), function (err){
            if(err)   return console.error("AT Command Request - " + err);
            //xbeeLog("AT Command Request successfully sended to UART.");
        });
    });
};

// ZigBee Transmit Request 0x10.
Xbee.prototype.ZBTransmitRequest = function(xbeeModule, dataTX){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
        destination64: xbeeAddr64[xbeeModule],
        destination16: xbeeAddr16[xbeeModule],  // Default is "fffe" (unknown/broadcast).
        broadcastRadius: 0x00,  // Optional, 0x00 is default.
        options: 0x00,          // Optional, 0x00 is default.
        data: dataTX            // Can either be string or byte array.
    };

    serialport.open(function(error){
        if(error)   return console.error("ZB Transmit Request - " + error);
        serialport.write(xbeeAPI.buildFrame(frame_obj), function (err){
            if(err)   return console.error("ZB Transmit Request - " + err);
            //xbeeLog("ZB Transmit Request successfully sended to UART.");
        });
    });
};

// Remote AT Command Request 0x17.
Xbee.prototype.remoteATCmdReq = function(xbeeModule, idFrame, ATCmd, cmdParameter){
    var serialport = this.serialport;
    var xbeeAPI = this.xbeeAPI;
    var addr64;
    var addr16;
    
    // When is a broadcast message change destination64 key to 0x000000000000FFFF
    if(xbeeModule === 'broadcast'){
        addr64 = '000000000000ffff';
        addr16 = 'fffe';
    }
    else{
        addr64 = xbeeAddr64[xbeeModule];
        addr16 = xbeeAddr16[xbeeModule];
    }
    
    var frame_obj = {
        type: this.C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
        destination64: addr64,
        destination16: addr16, // default is "fffe" (unknown/broadcast)
        command: ATCmd
    };
    // If an id frame was explicitly pass as parameter then use it.  
    if(idFrame !== null){
        frame_obj.id = idFrame;
    }
    // Do not create frame_obj.commandParameter key when cmdParameter is empty, this way
    // xbeeAPI.buildFrame() will interpret it as a remote AT command with no parameter.
    if((cmdParameter !== '') && (cmdParameter !== undefined) && (cmdParameter !== null)){
        frame_obj.commandParameter = [cmdParameter];
    }

    serialport.open(function(error){
        if(error)   return console.error("Remote AT Command Request - " + error);
        serialport.write(xbeeAPI.buildFrame(frame_obj), function (err){
            if(err)   return console.error("Remote AT Command Request - " + err);
            //console.log(xbeeModule +" - " + ATCmd + " Remote AT Command Request successfully sended to UART.");
        });
    });
};

//******************************************************************************
// Functions for received API frames.

// Frame Handler 0x88: AT Command Response.
Xbee.prototype.ATCmdResponse = function(frame){
    //xbeeLog(frame);
    var cmd = frame.command.toUpperCase();
    var cmdData = frame.commandData;
    var cmdStatusKey = frame.commandStatus;
    
    // If cmd respond with commandData, then show it.
    if(cmdStatusKey === 0x00 && typeof(cmdData) !== "undefined" && cmdData !== null && cmdData.length > 0){
        xbeeLog("Coordinator - " + cmd + " " + this.C.FRAME_TYPE[0x88] + ": " +
            this.C.COMMAND_STATUS[cmdStatusKey] + ". Command Data: [" + cmdData + "]");
    }
    else{
        xbeeLog("Coordinator - " + cmd + " " + this.C.FRAME_TYPE[0x88] + ": " +
            this.C.COMMAND_STATUS[cmdStatusKey] + ".");
    }
};

// Frame Handler 0x8B: ZigBee Transmit Status.
// When a Transmit Request is completed, the module respond with ZigBee Transmit Status.
Xbee.prototype.ZBTransmitStatus = function(frame, fn){
    //xbeeLog(frame);
    var xbeeKey = this.getXbeeKeyByAddress16(frame.remote16);
    var deliveryStatus = frame.deliveryStatus;
    var discoveryStatus = frame.discoveryStatus;
    var nodeInfoChanged = false;    // Turn true if any node info changed. 

    xbeeLog(xbeeKey + " - " + this.C.FRAME_TYPE[0x8B] + ": " +
            this.C.DELIVERY_STATUS[deliveryStatus] + ", " + this.C.DISCOVERY_STATUS[discoveryStatus]);

    // Update xbee's 16bit address only if it has changed.
    if(xbeeAddr16[xbeeKey] !== frame.remote16){
        xbeeAddr16[xbeeKey] = frame.remote16;
        nodeInfoChanged = true;     // Node's 16 bit address has changed.
    }
    
    // If delivery status is a Network ACK Failure (0x21), then set xbeeDiscovered as false.
    if((nodesDiscovered[xbeeKey] !== false) && (deliveryStatus === this.C.DISCOVERY_STATUS.NETWORK_ACK_FAILURE)){
        nodesDiscovered[xbeeKey] = false;
        nodeInfoChanged = true;     // Xbee node appears to be down.
    }
    
    // If delivery status is Success (0x00), then set xbeeDiscovered as true, only if it was false before.
    if((nodesDiscovered[xbeeKey] !== true) && (deliveryStatus === this.C.DISCOVERY_STATUS.SUCCESS)){
        nodesDiscovered[xbeeKey] = true;
        nodeInfoChanged = true;     // Xbee node appears to be down.
    }
    
    var nodeSummary = {"xbeeKey": xbeeKey, "xbeeAddr16": frame.remote16, "nodesDiscovered": nodesDiscovered[xbeeKey]};
    return fn(nodeInfoChanged, nodeSummary);
};


// Frame Handler 0x90: ZigBee Receive Packet.
// Receive string data from remote xbee module ZBTransmitRequest().
Xbee.prototype.ZBReceivePacket = function(frame, fn){
    //xbeeLog(frame);
    // Find which xbee module sended the packet.
    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
    var dataRxByte = frame.data;
    var nodeInfoChanged = false;    // Turn true if any node info changed. 
    
    // Convert data numbers to string format. Then parse sensor information.
    for(var i=0; i<dataRxByte.length; i++){
        dataRxByte[i] = String.fromCharCode(dataRxByte[i]);
    }
    
    // Join all array bytes into one string.
    var dataRxStr = dataRxByte.join('');

    // Separate in different cells each sensor measurement.
    var dataRxStrArr = dataRxStr.split('|');
    //xbeeLog(dataRxStrArr);

    for(var i=0; i<dataRxStrArr.length; i++){
        // First letter of each cell indicate the sensor type.
        var sensorType = dataRxStrArr[i][0];
        // Numbers between letter (first element) and '|' correspond to sensor measurement.
        var sensorValue = dataRxStrArr[i].slice(1, dataRxStrArr[i].length);
        sensorValue = parseFloat(sensorValue);  // Convert from string to float.
        
        switch(sensorType){
            case 't':   // Temperature Sensor.
                //xbeeLog('Temperature:', sensorValue);
                this.sensorData[xbeeKey].t = sensorValue;
                break;
            case 'p':   // Temperature Sensor.
                //xbeeLog('Temperature:', sensorValue);
                this.sensorData[xbeeKey].p = sensorValue;
                break;
            case 'h':   // Humidity Sensor.
                //xbeeLog('Humidity:', sensorValue);
                this.sensorData[xbeeKey].h = sensorValue;
                break;
            case 'l':   // Light Sensor.
                //xbeeLog('Light:', sensorValue);
                this.sensorData[xbeeKey].l = sensorValue;
                break;
            case 'c':   // Analog Current Sensor.
                //xbeeLog('Current:', sensorValue);
                this.sensorData[xbeeKey].c = (sensorValue*3.286*1000/4095/1.41421).toFixed(1);
                break;
            case 's':   // Analog Sound Sensor.
                //xbeeLog('Sound:', sensorValue);
                this.sensorData[xbeeKey].s = (sensorValue*3.286*1000/4095/1.41421).toFixed(1);
                break;
            case 'g':   // Analog Gas Sensor.
                //xbeeLog('Gas:', sensorValue);
                this.sensorData[xbeeKey].g = (sensorValue*3.286*1000/4095/1.41421).toFixed(1);
                break;    
        }
    }
    xbeeLog(xbeeKey + ' - ZB Receive Packet (0x90):' + ' t=' + this.sensorData[xbeeKey].t
                                                     + ' p=' + this.sensorData[xbeeKey].p
                                                     + ' h=' + this.sensorData[xbeeKey].h
                                                     + ' l=' + this.sensorData[xbeeKey].l
                                                     + ' c=' + this.sensorData[xbeeKey].c
                                                     + ' s=' + this.sensorData[xbeeKey].s
                                                     + ' g=' + this.sensorData[xbeeKey].g);
    
    // Update xbee's 16bit address only if it has changed.
    if(xbeeAddr16[xbeeKey] !== frame.remote16){
        xbeeAddr16[xbeeKey] = frame.remote16;
        nodeInfoChanged = true;     // Node's 16 bit address has changed.
    }
    
    var nodeSummary = {"xbeeKey": xbeeKey, "xbeeAddr16": frame.remote16};
    return fn(nodeInfoChanged, nodeSummary)
};


// Frame Handler 0x92: ZigBee IO Data Sample Rx Indicator.
// Return xbee key and temperature value.
Xbee.prototype.ZBIODataSampleRx = function(frame, fn){
    //xbeeLog(frame);
    var nodeInfoChanged = false;    // Turn true if any node info changed. 
    var xbeeAnalog = frame.analogSamples.AD3;   // Analog value read by xbee module.
    var volt = (xbeeAnalog/1200)*1.057; // Convert the analog value to a voltage value.

	// Calculate temp in C, .75 volts is 25 C. 10mV/°C
	var temp = 100*(volt - 0.5);
	//xbeeLog(this.getXbeeKeyByAddress64(frame.remote64), xbeeAnalog, volt, temp);

    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
    this.sensorData[xbeeKey].tempAccum += temp;
    this.sensorData[xbeeKey].sampleNum += 1;
    
    if(xbeeKey === 'xb3'){
        var xbeeAnalog = frame.analogSamples.AD0;   // Analog value read by xbee module.
        var volt = (xbeeAnalog*1200)/1023/1.41421; // Convert the analog value to RMS mV value.
        var current = volt*30/1000;
        var power = 225*current;
        xbeeLog(xbeeKey + ' - ZB IO Data Sample Rx (0x92):' + ' V=' + volt.toFixed(1)+ 'mV ' + ' Power=' + power.toFixed(1) + 'W.');
    }
    //xbeeLog(xbeeKey + ' - ZB IO Data Sample Rx (0x92):' + ' temperature=' + temp.toFixed(2) + '°C.');
    
    // Update xbee's 16bit address only if it has changed.
    if(xbeeAddr16[xbeeKey] !== frame.remote16){
        xbeeAddr16[xbeeKey] = frame.remote16;
        nodeInfoChanged = true;     // Node's 16 bit address has changed.
    }
    
    var nodeSummary = {"xbeeKey": xbeeKey, "xbeeAddr16": frame.remote16};
    return fn(nodeInfoChanged, nodeSummary)
};


// Frame Handler 0x97: Remote Command Response.
Xbee.prototype.remoteCmdResponse = function(frame, fn){
    //console.log(frame);
    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
    var cmd = frame.command.toUpperCase();
    var cmdData = frame.commandData;
    var cmdStatus = frame.commandStatus;
    var nodeInfoChanged = false;    // Turn true if any node info changed.
    
    // If cmd respond with commandData, then show it.
    if(cmdStatus === 0x00 && typeof(cmdData) !== "undefined" && cmdData !== null && cmdData.length > 0){
        xbeeLog(xbeeKey + " - " + cmd + " " + this.C.FRAME_TYPE[0x97] + ": " +
            this.C.COMMAND_STATUS[cmdStatus] + ". Command Data: [" + cmdData + "]");
    }
    else{
        xbeeLog(xbeeKey + " - " + cmd + " " + this.C.FRAME_TYPE[0x97] + ": " +
            this.C.COMMAND_STATUS[cmdStatus] + ".");
    }

    // Update xbee's 16bit address only if it has changed. When node goes down, frame.remote16 change to 'fffe'.
    if(xbeeAddr16[xbeeKey] !== frame.remote16){
        xbeeAddr16[xbeeKey] = frame.remote16;
        nodeInfoChanged = true;     // Node's 16 bit address has changed.
    }
    
    // If response command status is a Remote Command Transmission Failed (0x04), then set xbeeDiscovered as false.
    if((nodesDiscovered[xbeeKey] !== false) && (cmdStatus === this.C.COMMAND_STATUS.REMOTE_CMD_TRANS_FAILURE)){
        nodesDiscovered[xbeeKey] = false;
        nodeInfoChanged = true;     // Xbee node appears to be down.
    }
    
    // If response command status is OK (0x00), then set xbeeDiscovered as true, only if it was false before.
    if((nodesDiscovered[xbeeKey] !== true) && (cmdStatus === this.C.COMMAND_STATUS.OK)){
        nodesDiscovered[xbeeKey] = true;
        nodeInfoChanged = true;     // Xbee node appears to be down.
    }
    
    var nodeSummary = {"xbeeKey": xbeeKey, "xbeeAddr16": frame.remote16, "nodesDiscovered": nodesDiscovered[xbeeKey]};
    return fn(nodeInfoChanged, nodeSummary);
};

// Frame Handler 0xA1: Route Record Indicator.
Xbee.prototype.routeRecordIndicator = function(frame, fn){
    //console.log(frame);
    var xbeeKey = this.getXbeeKeyByAddress64(frame.remote64);
    var hopsAddresses = frame.hopsAddresses.map(this.getXbeeKeyByAddress16);  // array 16bit addresses -> array xbee keys.
    var nodeInfoChanged = false;    // Turn true if any node info changed.
    
    xbeeLog(xbeeKey + " - " + this.C.FRAME_TYPE[0xA1] + ". " +
            "Hop nodes: [" + hopsAddresses + "]");

    // Update xbee's 16bit address only if it has changed.
    if(xbeeAddr16[xbeeKey] !== frame.remote16){
        xbeeAddr16[xbeeKey] = frame.remote16;
        nodeInfoChanged = true;     // Node's 16 bit address has changed.
    }

    // If new route is different from preview's one, update it.
    if(areArraysDifferent(networkRoutes[xbeeKey], hopsAddresses)){
        networkRoutes[xbeeKey] = hopsAddresses; // Left: hop closer to remote module. Right: hop closer to coordinator.
        nodeInfoChanged = true;     // Network route has changed.
    }
    // If routes hasn't changed, set function callback with false.
    var nodeSummary = {"xbeeKey": xbeeKey, "xbeeAddr16": frame.remote16, "networkRoutes": networkRoutes[xbeeKey]};
    return fn(nodeInfoChanged, nodeSummary);
    
    function areArraysDifferent(arrayA, arrayB){
        // return true inmediatelly when they have different length.
        if(arrayA.length !== arrayB.length) return true;
        
        // If they have the same length, but its elements are different, return true.
        for(var i=0; i<arrayA.length; i++){
            if(arrayA[i] !== arrayB[i]) return true;
        }
        
        // If none of the previews condition were executed, then arrays must be the same.
        return false;
    }
};


//******************************************************************************
// Auxiliar funtions

// Retrieve xbee addresses.
Xbee.prototype.getXbeeAddr64 = function(){
    return xbeeAddr64;
}
Xbee.prototype.getXbeeAddr16 = function(){
    return xbeeAddr16;
}
// Retrieve xbee routes.
Xbee.prototype.getNetworkRoutes = function(){
    return networkRoutes;
}
// Retrieve nodes discovered.
Xbee.prototype.getNodesDiscovered = function(){
    return nodesDiscovered;
}

// Retrieve xbee xbeeKey based on address: '0013a20040b82646' --> 'xbee1'
Xbee.prototype.getXbeeKeyByAddress64 = function(address){
    //if(address === undefined || address === null || address === '') return 'noXbee';
    for(var xbeeKey in xbeeAddr64){
        if(xbeeAddr64[xbeeKey] === address) return xbeeKey;
    }
};

// Retrieve xbee key based on address: '2143' --> 'xbee1'
Xbee.prototype.getXbeeKeyByAddress16 = function(address){
    //if(address === undefined || address === null || address === '') return 'noXbee';
    for(var xbeeKey in xbeeAddr16){
        if(xbeeAddr16[xbeeKey] === address) return xbeeKey;
    }
};

// Search and store all nodes not discovered. Return an array containing all of it.
Xbee.prototype.searchNodesNotDiscovered = function(){
    this.nodesNotDiscovered = [];
    for(var xbeeKey in nodesDiscovered){
        if(nodesDiscovered[xbeeKey] === false) this.nodesNotDiscovered.push(xbeeKey);
    }
    return this.nodesNotDiscovered;
}


module.exports = Xbee;