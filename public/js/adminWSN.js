/*
    Client side script for handling admin tools in the WSN.
*/

$(document).on("pagecreate", function(){
    // Jquery variables.
    var $adminPanel = $('#adminPanel');
    var $cmdReqPanel = $('#cmdReqPanel');
    var $xbeeWSNInfoPanel = $('#xbeeWSNInfoPanel');
    var $connectionStatus = $('#connectionStatus');

    // Global variables.
    var guiActiveTime = 3*60*1000;  // Miliseconds.

    var socket = io.connect('pipobbb.mooo.com:8888',{
        forceNew: true,
        rememberUpgrade: true,
        transports: ['xhr-polling', 'websocket', 'flashsocket', 'polling']
    });

    // Check system speed for concluding socket connection.
    console.time('connection');    
    // Each time client connects/reconnects, toggle grayed GUI.
    socket.on('connect',function(){
        console.timeEnd('connection');
        console.log('Connect socket status: ', socket.io.engine);

        // Enable graphical user interface GUI.
        enableGUI();
        
        // Emit req for xbee WSN info data.
        // Retrieve Xbees/Nodes network info (routes, addresses, devices down) and create a table.
        socket.emit('reqXbeeWSNInfo');
        socket.on('respXbeeWSNInfo', function(jsonXbeeWSNInfo){
            $xbeeWSNInfoPanel.empty();  // Empty the div.
            // All table html code is implemented in javascript to avoid problem with table 
            // responsiveness (columntoggle). Problem when mixing static html parts and dynamic added parts.
            var tableString = '';
            tableString += '<table id="adminTable" data-role="table" data-column-btn-text="Columns to display" data-mode="columntoggle" class="reference ui-responsive ui-shadow table-stroke">';
                tableString += '<thead><tr>';
                tableString += '<th id="th-nodes">Nodes</th>';
                tableString += '<th id="th-status">Status</th>';
                tableString += '<th id="th-routes" data-priority="1">Routes</th>';
                tableString += '<th id="th-16BitAddr" data-priority="2">16bit Addr</th>';
                tableString += '<th id="th-64BitAddr" data-priority="3">32bit Addr</th>';
                tableString += '</tr></thead>';
            tableString += '<tbody id="tbody-admin">';
                        
            for(var xbeeKey in jsonXbeeWSNInfo.networkRoutes){  // networkRoutes start from xb1, not from xb0.
                var status = jsonXbeeWSNInfo.nodesDiscovered[xbeeKey] ? 'Up' : 'Down'; // If ND is true then set to status to Up.
                var statusColor = jsonXbeeWSNInfo.nodesDiscovered[xbeeKey] ? 'green' : 'red';
                var route = jsonXbeeWSNInfo.networkRoutes[xbeeKey].join(' > ');
                var addr16 = jsonXbeeWSNInfo.xbeeAddr16[xbeeKey];
                var addr64 = jsonXbeeWSNInfo.xbeeAddr64[xbeeKey].slice(8);  // Only the LSB.
                tableString += '<tr id="tr-'+xbeeKey+'">';
                    tableString += '<td class="td-xbeeKey">'+xbeeKey+'</td>';
                    tableString += '<td class="td-status" style="color:'+statusColor+'"><b>'+status+'</b></td>';
                    tableString += '<td class="td-routes">'+route+' > c'+'</td>';
                    tableString += '<td class="td-xbeeAddr16">'+'0x'+addr16+'</td>';
                    tableString += '<td class="td-xbeeAddr64">'+'0x'+addr64+'</td>';
                tableString += '</tr>';
            }
            tableString += '</tbody>';
            tableString += '</table>';
            $xbeeWSNInfoPanel.append(tableString);
            $("#adminTable-popup-popup").remove();
            $xbeeWSNInfoPanel.trigger('create');
        });
    });

    // Only when a node info has changed, a node summary data will be received.
    socket.on('xbeeInfoChanged', function(nodeSummary){
        var xbeeKey = nodeSummary.xbeeKey;
        
        if(nodeSummary.nodesDiscovered !== '' && nodeSummary.nodesDiscovered !== undefined && nodeSummary.nodesDiscovered !== null){
            var status = nodeSummary.nodesDiscovered ? 'Up' : 'Down';
            $('#adminTable').find('#tr-'+xbeeKey).find('.td-status').html('<b>'+status+'</b>');
            if(status === 'Up') $('#adminTable').find('#tr-'+xbeeKey).find('.td-status').css('color', 'green');
            else $('#adminTable').find('#tr-'+xbeeKey).find('.td-status').css('color', 'red');
        }
        if(nodeSummary.xbeeAddr16 !== '' && nodeSummary.xbeeAddr16 !== undefined && nodeSummary.xbeeAddr16 !== null){
            var xbeeAddr16 = '0x'+nodeSummary.xbeeAddr16;
            $('#adminTable').find('#tr-'+xbeeKey).find('.td-xbeeAddr16').html(xbeeAddr16);
        }
        if(nodeSummary.networkRoutes !== '' && nodeSummary.networkRoutes !== undefined && nodeSummary.networkRoutes !== null){
            var networkRoutes = nodeSummary.networkRoutes.join(' > ') + ' > c';
            $('#adminTable').find('#tr-'+xbeeKey).find('.td-routes').html(networkRoutes);
        }
    });

    // Display input buttons for command request.
    // Panel need xbeeKey to generate the options for the input select.
    socket.once('respXbeeWSNInfo', createCmdReqPanel);
    function createCmdReqPanel(jsonXbeeWSNInfo){ 
        $cmdReqPanel.empty();  // Empty the div.

		// Create xbee remote AT command request gui form.
        var optionSelectString = '';
        // First option in the select input is broadcast.
        optionSelectString += '<option value="broadcast">broadcast</option>';
        optionSelectString += '<option value="coordinator">coordinator</option>';
        // Retrieve xbee key (xb1, xb2, ...) and put them as select options.
        for(var xbeeKey in jsonXbeeWSNInfo.xbeeAddr16){
            optionSelectString += '<option value="' + xbeeKey + '">' + xbeeKey + '</option>';
        }
        // Add inputs to the web.
		$cmdReqPanel.append(
		'<div class="ui-field-contain" id="remoteATCmdReq-gui">\
		    <select id="select-xbee" data-mini="true" data-inline="true">\
		        ' + optionSelectString + '\
            </select>\
            <input type="text" id="text-xbee-cmd" value="" placeholder="Xbee Cmd" size="8">\
            <input type="text" id="text-xbee-param" value="" placeholder="Parameter" size="8">\
            <button class="ui-btn ui-btn-inline ui-mini ui-corner-all" id="xbee-cmd-send">Send</button>\
        </div>\
        <div id="frame-text-div">\
        </div>'
        );
        $cmdReqPanel.trigger('create');
        $('#remoteATCmdReq-gui').find('.ui-select').addClass('horizontal-select'); // This way css can choose only this select input.
        $('#remoteATCmdReq-gui').find('.ui-input-text').addClass('horizontal-text'); // This way css can choose only this text inputs.
    }
    
    // Handle local and remote AT command request gui interactions.
    $cmdReqPanel.on('click', '#xbee-cmd-send', function(){
        var xbeeIdReq = $("#select-xbee option:selected").val()
        var xbeeCmdReq = $('#text-xbee-cmd').val();
        var xbeeParamReq = $('#text-xbee-param').val();
        var xbeeCmdObj = {'xbeeId': xbeeIdReq, 'xbeeCmd': xbeeCmdReq, 'xbeeParam': xbeeParamReq};
        socket.emit('clientXbeeCmdReq', xbeeCmdObj);  // Now client must wait for command response.
    });
    // Clear input text for command and command parameter when clicking command input.
    $cmdReqPanel.on('click', '#text-xbee-cmd', function(){
        $(this).val('');
        $cmdReqPanel.find('#text-xbee-param').val('');
    });
    $cmdReqPanel.on('click', '#text-xbee-param', function(){
        $(this).val('');
    });

    // Update connection status.
    $(window).on('click', function(){
        // If admin panel is disabled, clicking in grayed background return connection to server.
        if($adminPanel.hasClass('ui-state-disabled')){
            $connectionStatus.text('Reconnecting');
		    $connectionStatus.css('color', '#2356e1');
		    socket.io.connect();
        }
        // If control panel is available, then each click reset setTimeout's timer.
        // I.E. disconnection will occur # seconds after last click.
        else{
            clearTimeout(timerTimeout);
            timerTimeout = null;
            // Reset disconnection time 'guiActiveTime' seconds.
            timerTimeout = setTimeout(disconnectOnTimeout, guiActiveTime);
        }
    });
    
    //$(window).blur(windowBlur);  // No se activa al cambiar de pagina internamente
    //$(window).focus(windowFocus);

    // Phone Chrome doesn't detect .blur() events, others browsers do. Waiting for some patches.
    //$(window).on('blur', windowBlur);
    function windowBlur(){
        // Clear timer to avoid another disconnection on timeout.
        clearTimeout(timerTimeout);
        timerTimeout = null;
        // On window losing focus, disconnect from server.
        socket.io.disconnect();
        // Disable all control panel input elements. Grayed background. It will be re-enable in reconnection.
        $adminPanel.addClass('ui-state-disabled');
    }
    
    $(window).on('focus', windowFocus);
    function windowFocus(){
        // If control panel is disabled, focus will try to reconnect.
        if ($adminPanel.hasClass('ui-state-disabled')){
            $connectionStatus.text('Reconnecting');
		    $connectionStatus.css('color', '#2356e1');
            socket.io.connect();
        }
    }
    
    function enableGUI(){
        // Update connection status.
        $connectionStatus.text('Online');
		$connectionStatus.css('color', 'green');
        // When connection is established, enable all control elements if previously disabled.
        $adminPanel.removeClass("ui-state-disabled");

        // Disconnect from server after 'guiActiveTime' seconds. Reconnection occurs when user clicks on grayed background.        
        timerTimeout = null;
        timerTimeout = setTimeout(disconnectOnTimeout, guiActiveTime);
    }

    socket.on('disconnect', function(reason){
        $connectionStatus.text('Offline ' + reason);
		$connectionStatus.css('color', 'red');
    });

    function disconnectOnTimeout(){
        // Close connection after # seconds.
        socket.io.disconnect();
        // Disable all control panel input elements. Grayed background. Re-enable it in reconnection.
        $adminPanel.addClass('ui-state-disabled');
    }
});
