import { app } from "../../../scripts/app.js";
import {api} from "../../../scripts/api.js";

let nodeGraph;

let the_widget;

let node_obj_map;
let updated_Map;

let node_name_list;

//ID of the selected node 
let selected_node_ID;

//ID of displayHistoryNode that is currently being selected 
let current_dN_ID


// TODO: 
// 1. node name changing fucks stuff up (maybe add logic so that it's like if duplicate names, append IDs to their display names) //sort of fixed
// 2. if node gets deleted it should be removed from display list // DONE
// 3. only one instance of DisplayHistory is going to work because bad code lol // FIXED
// 4. Reloading node screws a lot stuff up (try to overwrite when nodes are reloaded?) // FIXED 
// 5. clean up the messageHandling stuff 
// 6. running another workflow grabs the nodes from that workflow too // FIXED

// Features later:
// take a certain iteration and put the settings back into the wanted node 
// be able to right click on node and see its ID or append ID to title 

// some notes:
// when new nodes are made or copied and pasted their initial selection cannot have its parameted listed because the changeWidgetLable function takes in the node's id 
// and the node's id has not been made yet in nodeCreated()

// cool idea:
// feature where if you click on a node then press C you can automatically connect it to the closest node with valid input?

app.registerExtension({
	name: "example.DisplayMessage",
    //this runs every time nodes are loaded/reloaded 
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeType.comfyClass == "DisplayHistory") {
            console.log(nodeType.prototype);

            const dblClick = nodeType.prototype.onInputDblClick 
            nodeType.prototype.onInputDblClick = function() {
                const r = onInputDblClick?.apply(this, arguments);   
                console.log("logged double click");
                return r
            }

            if (node_name_list) {
                //input list
                nodeData.input.required.node[0] = node_name_list;
            }
        }
    },

    async beforeConfigureGraph() {
        initNodeStuff();
    },

    async nodeCreated(node) {
        makeNodeStuff(node);
        console.log("node created from nodeCreate");

        if (node.title == "Display History" && node_name_list) {
            assignListToWidget(node);
        }

        //hook the remove & name change logic onto every node 
        onNodeRemove(node);
    },

    // This runs when workflws are loaded & when reloaded 
    async afterConfigureGraph() {
        console.log("after configure graph", app.graph.id);
        nodeGraph = app.graph;
        updateNodeIDs();
        setupDNodes();
        updateNodeStuff();

        console.log(app);

        console.log(nodeGraph);
    },

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
    },

    async onPropertyChange(node) {
        console.log(node);
    },


})

function initNodeStuff() {
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
            node_name_list.push(encodeLabel(node.title, ID));
        }
    });
    node_obj_map.clear();
}

/*
- Function: assigns node_name_list to the search widget (mainly used for freshly spawned displayHistory nodes that didn't exist in the workflow)
- Params: Display History node obj
- Returns: none
*/
function assignListToWidget(displayHistoryNode) {
    let widgets = displayHistoryNode.widgets;
    let search_widget = widgets[0];
    search_widget.options.values = node_name_list;

    getSelected(search_widget);
}

function setupDNodes() {
    let dNodes = nodeGraph.findNodesByType("DisplayHistory");
    dNodes.forEach(node => {
        let widgets = getNodeWidgetList(node.id);
        let txt_widget = widgets[1];
        txt_widget.inputEl.readOnly = true;
        
        let search_widget = widgets[0];
        search_widget.options.values = node_name_list;

        selected_node_ID = decodeLabel(search_widget.value);
        changeWidgetLabel(selected_node_ID, node.id);

        getSelected(search_widget);

    })
}

function updateNodeStuff() {
    updated_Map.forEach((value, key) => {
        let node_ID = key;
        let node_obj = JSON.parse(JSON.stringify(value));
        let old_params = node_obj["params"];
        const new_params = {};

        let widget_list = getNodeWidgetList(node_ID);

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

        checkNameChange(node_ID);
        changeAllWidgetLabels();
    });
}


//gets the selected node, puts it in the widget's placeholder and returns it
function getSelected(widget) {
    const originalCallback = widget.callback;
    widget.callback = function(value, graphCanvas, node) {
        console.log("selected:", this.value);
        selected_node_ID = decodeLabel(this.value);
        current_dN_ID = node.id;
        if (originalCallback) {
            originalCallback.apply(widget, arguments);
        }
        //the node_ID is the selected node's ID 
        // the node is the parent node (which DisplayHistory node is it)
        changeWidgetLabel(selected_node_ID, current_dN_ID);
    }
}

function decodeLabel(selected_label) {
    let string = selected_label.match(/\d+/);
    let node_ID = string ? parseInt(string[0]) : NaN;
    return node_ID;
}

/*
- Function: updates the text labels w/ updated parameter histories for all display History nodes 
- Params: none
- Returns: none
*/
function changeAllWidgetLabels() {
    let dNodes = nodeGraph.findNodesByType("DisplayHistory");
    dNodes.forEach(node => {
        let widgets = getNodeWidgetList(node.id);

        let search_widget = widgets[0];
        let currently_selected_node_label = search_widget.value;
        let currently_selected_node_id = decodeLabel(currently_selected_node_label);

        changeWidgetLabel(currently_selected_node_id, node.id);
    })
}


function changeWidgetLabel(node_ID, displayNode_ID) {
    let widgets = getNodeWidgetList(displayNode_ID);
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


function onNodeRemove(node) {
    //seems to be a onRemoved attribute on a node, explore later
    const originalCallback = node.onRemoved;
    node.onRemoved = function() {
        console.log("node removed", node);
        
        let label = encodeLabel(node.title, node.id)
        let list_index = node_name_list.indexOf(label);

        node_name_list.splice(list_index, list_index);
        updated_Map.delete(node.id);

        console.log(node_name_list);

        if (originalCallback) {
            originalCallback.apply(arguments);
        }
    }

}

function checkNameChange(node_ID) {
    let node_obj = updated_Map.get(node_ID);
    let old_title = node_obj["name"];

    let node = nodeGraph.getNodeById(node_ID);
    let current_title = node.title;

    if (current_title != old_title) {
        let old_label = encodeLabel(old_title, node_ID);
        let list_index = node_name_list.indexOf(old_label);

        node_name_list.splice(list_index, list_index);

        let new_label = encodeLabel(current_title, node_ID);

        node_name_list.push(new_label);
    }
}

function getNodeWidgetList(node_ID) {
    let node = nodeGraph.getNodeById(node_ID);
    return node.widgets;
}

function encodeLabel(nodeTitle, node_ID) {
    return `${nodeTitle}, ID: ${node_ID}`
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
