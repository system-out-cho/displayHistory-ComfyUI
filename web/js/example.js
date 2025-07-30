import { app } from "../../../scripts/app.js";
import {api} from "../../../scripts/api.js";

let nodeGraph;
let nodesList;

let the_widget;

let node_obj_map;
let updated_Map;

let node_name_list;

let selected_node_ID;

let graph_map;
let current_graph_ID;

// TODO: 
// 1. node name changing fucks stuff up (maybe add logic so that it's like if duplicate names, append IDs to their display names)
// 2. if node gets deleted it should be removed from display list 
// 3. only one instance of DisplayHistory is going to work because bad code lol 
// 4. Reloading node screws a lot stuff up (try to overwrite when nodes are reloaded?) //DONE 
// 5. clean up the messageHandling stuff 
// 6. running another workflow grabs the nodes from that workflow too

// Features later:
// take a certain iteration and put the settings back into the wanted node 
// be able to right click on node and see its ID 
// 



// PRIORITY (workflow grabbing stuff)
// each graph has their own node_obj_map and updated_Map to get history of 

app.registerExtension({
	name: "example.DisplayMessage",
    async setup() {

        function messageHandler(event) { 
            the_widget.inputEl.placeholder = event.detail.message;
        }
        app.api.addEventListener("DisplayHistory.message", messageHandler);

        function on_execution_success() { 
            console.log("WORKFLOW RAN");
            updateNodeIDs();
            updateNodeStuff();
        }
        api.addEventListener("execution_success", on_execution_success);
        
        initNodeStuff();
    },
    async nodeCreated(node) {
        makeNodeStuff(node);
    },
    //this had valid id for every node (doesnt run when new node is made)
    //but thats fine cause not like i update list till after it runs anyway
    //maybe ill change it to use this instead of nodeCreated() but later
    async loadedGraphNode(node) {
    },
    //this runs every time nodes are loaded/reloaded 
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // console.log(nodeData);
        if (nodeType.comfyClass == "DisplayHistory") {
            console.log(app);
            //not first time running
            if (node_name_list) {
                //input list
                nodeData.input.required.node[0] = node_name_list;
            }
        }
    },


})

//change this so that it actually checks when it's loaded instead of doing whatever the
//hell this is 


const intervalId = setInterval(() => {
    if (app.graph._nodes.length > 0) {
        nodeGraph = app.graph;
        nodesList = app.graph._nodes;
        current_graph_ID = app.graph.id;
        // console.log(nodeGraph);
        
        
        // console.log(node_obj_map);
        
        //only grabbing first instance of DisplayHistory, make it change all of them later (make a func for this)
        //shouldnt be index based or title based bc of multiple Display Histories
        //attatch listeners once
        let the_node = nodeGraph.findNodesByType("DisplayHistory");
        let widgets = the_node[0].widgets; 
        the_widget = widgets[1];
        the_widget.inputEl.readOnly = true;
        the_widget.inputEl.placeholder = "I hope this is working";

        //populate list
        
        //get list of all display node histories and make them this 
        //prob make a function to be able to change their lists dynamically
        let search_widget = widgets[0];
        search_widget.options.values = node_name_list;

        setCurrentGraph();
        getSelected(search_widget);

        clearInterval(intervalId); // stop checking
    }
}, 100);



function allDisplayHistoryNodes() {
    let dhNodes = nodeGraph.findNodesByType("DisplayHistory");
}

function setCurrentGraph() {
    const originalLoadGraphData = app.loadGraphData;
    app.loadGraphData = async function (graphData, ...args) {
        console.log("switched to", app.graph.id);
        current_graph_ID = app.graph.id;
        return await originalLoadGraphData.call(this, graphData, ...args);
    }
}

//gets the selected node, puts it in the widget's placeholder and returns it
function getSelected(widget) {
    let selected;
    const originalCallback = widget.callback;
    widget.callback = function(value, graphCanvas, node) {
        console.log("selected:", this.value);
        selected = this.value;
        let string = selected.match(/\d+/);
        let node_ID = string ? parseInt(string[0]) : NaN;
        selected_node_ID = node_ID;
        if (originalCallback) {
            originalCallback.apply(widget, arguments);
        }
        //the node_ID is the selected node's ID 
        // the node is the parent node (which DisplayHistory node is it)
        changeWidgetLabel(node_ID, node);
    }
    return selected;
}

function changeWidgetLabel(node_ID, displayNode) {
    // console.log(displayNode);
    let widgets = displayNode.widgets;
    let text_widget = widgets[1];

    let paramaters = updated_Map.get(node_ID)["params"];
    text_widget.inputEl.placeholder = pretty_print(paramaters);
}

function pretty_print(parameters) {
    let string_output = "";
    // console.log(parameters);

    for (const key in parameters) {
        let label = key;
        let label_value = parameters[key];

        let reversed_array = label_value.slice().reverse();
        let string_line = `${label}: ${reversed_array}\n`;
        string_output += string_line;
    }

    return string_output;
}


function onNodeRemove() {
    //seems to be a onRemoved attribute on a node, explore later
}

function initNodeStuff() {
    graph_map = new Map();
    node_obj_map = new Map();
    node_name_list = [];
    updated_Map = new Map();
}

//initialize node_obj_list
function makeNodeStuff(node) {
    // for each node grab the name, its widget labels and values (parameters), and add it to object list 
    // define objects
    const params = {};
    const node_obj = {};

    // grab widget label & name for each widget
    let widget_list = node.widgets;
    // console.log(node.title, widget_list);

    if (widget_list) {
        widget_list.forEach(widget => {
            params[widget.label] = [widget.value];
        })
        
        //add name and param obj to node_obj and push it to obj list 
        //need to make this into an actual ID and not the title 
        node_obj["name"] = node.title;
        node_obj["params"] = params;

        node_obj_map.set(node, node_obj);
    
        //add node name to list of node names
    }

}

function updateNodeIDs() {
    node_obj_map.forEach((value, key) => {
        let node = key;
        let node_obj = value;

        const ID = node.id;
        if (ID != -1) {
            updated_Map.set(ID, node_obj);
            node_name_list.push(`${node.title}, ID: ${ID}`);
        }
    });
    node_obj_map.clear();
}

function updateNodeStuff() {
    updated_Map.forEach((value, key) => {
        let node_ID = key;
        let node_obj = JSON.parse(JSON.stringify(value));
        let old_params = node_obj["params"];
        const new_params = {};

        let widget_list = getNodeWidgetList(node_ID);

        // console.log(node_ID, widget_list);

        widget_list.forEach(widget => {
            let oldWidgetList = old_params[widget.label];
            let newWidgetList = oldWidgetList;
            if (oldWidgetList) {
                let lastWidgetvalue = oldWidgetList[oldWidgetList.length - 1];
                let newWidgetValue = widget.value;
    
                // if user changed widget value, then append
                if (newWidgetValue != lastWidgetvalue) newWidgetList.push(newWidgetValue); 
    
            } else {
                newWidgetList = [];
            }
            new_params[widget.label] = newWidgetList;
        })

        node_obj["params"] = new_params;

        updated_Map.set(node_ID, node_obj);

        if (selected_node_ID) changeWidgetLabel(selected_node_ID);
    });
}

function getNodeWidgetList(node_ID) {
    let node = nodeGraph.getNodeById(node_ID);
    return node.widgets;
}


//for sending messages to the backend 
api.addEventListener("proxy", function proxyHandler (event) {
    console.log("event", event);
    const data = event.detail
    const reply = {
        node_id: data.id,
        outputs: {
        output: node_obj_map.get("KSampler"),
        nodeNameList: node_name_list,
        }
    }

    api.fetchApi("/proxy_reply", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify(reply),
    })
})
