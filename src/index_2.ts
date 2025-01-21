import Graph from "graphology";
import * as d3 from "d3";

import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";

import {Coordinates, EdgeDisplayData, NodeDisplayData} from "sigma/types";

import data from "../data/ms_data.json";

function calculateEdgeSize( edge: string,  graph: Graph): number {
    const files = graph.getEdgeAttribute(edge, "files");

    // Calculate a basic size based on the `files` attribute of both nodes
    // normalize and limit between 3 and 19
    return Math.min(19, Math.max(3, (files) / 10));
}
function populateColorScaleLegend() {
    const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);
    const colorScaleLegend = document.getElementById("color-scale-gradient")!;
    colorScaleLegend.style.position = "relative";
    colorScaleLegend.style.height = "20px";
    colorScaleLegend.style.width = "100%";
    colorScaleLegend.style.marginTop = "10px";
    colorScaleLegend.style.background = `
        linear-gradient(to right, 
            ${colorScale(0)} 0%, 
            ${colorScale(0.25)} 25%, 
            ${colorScale(0.5)} 50%, 
            ${colorScale(0.75)} 75%, 
            ${colorScale(1)} 100%)
    `;
}
function initializeGraph() {
    console.log("Script is running");

    // Retrieve some useful DOM elements:
    const container = document.getElementById("sigma-container") as HTMLElement;
    console.log(container)
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    console.log(searchInput)
    const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;
    console.log(searchSuggestions)
    const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);

    // Instantiate sigma:
    const graph = new Graph();
    graph.import(data);
    console.log(data)
    // graph.edges().forEach((edge: string) => {
    //
    //
    //     // Ensure that gravity is a number between 0 and 1 for each edge
    //     // const gravity = Math.random();
    //     // Update edge color based on gravity
    //     // const color = colorScale(gravity);
    //     // const randomFiles = Math.floor(Math.random() * 100) + 1;
    //
    //     // graph.setEdgeAttribute(edge, "gravity", gravity);
    //     // graph.setEdgeAttribute(edge, "files", randomFiles);
    //     // graph.setEdgeAttribute(edge, "color", colorScale(graph.getEdgeAttribute(edge, "gravity")));  // Set the edge color based on the gravity value
    // });

    // Set uniform color for all nodes (elegant muted color)
    const nodeColor = "#FEF0D9"; // Muted blue-gray (modern, sleek color)
    populateColorScaleLegend();

    // Graphology provides an easy-to-use implementation of Force Atlas 2 in a web worker
    const sensibleSettings = forceAtlas2.inferSettings(graph);
    const fa2Layout = new FA2Layout(graph, {
        settings: sensibleSettings
    });

    const edgeTooltip = document.getElementById("tooltip") as HTMLDivElement;
    edgeTooltip.style.position = "absolute";
    edgeTooltip.style.background = "white";
    edgeTooltip.style.border = "1px solid black";
    edgeTooltip.style.padding = "5px";
    edgeTooltip.style.borderRadius = "3px";
    edgeTooltip.style.display = "none";
    edgeTooltip.style.zIndex = "1000";


    // Assign random gravity values between 0 and 1 to each edge


    fa2Layout.start();

    const renderer = new Sigma(graph, container, {
        enableEdgeEvents: true
    });

    // Run the layout for a specified number of iterations or until stable
    setTimeout(() => {
        fa2Layout.stop();
        renderer.refresh();
    }, 5000);

    // State for drag'n'drop
    let draggedNode: string | null = null;
    let isDragging = false;

    // Internal state:
    interface State {
        hoveredNode?: string;
        hoveredEdge?: string;
        searchQuery: string;
        selectedNode?: string;
        suggestions?: Set<string>;
        hoveredNeighbors?: Set<string>;
        hoovering?: boolean
    }
    const state: State = { searchQuery: "", hoovering: false};

    renderer.on("downNode", (e) => {
        isDragging = true;
        draggedNode = e.node;
        graph.setNodeAttribute(draggedNode, "highlighted", true);
        if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
    });

    // On mouse move, if the drag mode is enabled, we change the position of the draggedNode
    renderer.on("moveBody", ({ event }) => {
        if (!isDragging || !draggedNode) return;

        // Get new position of node
        const pos = renderer.viewportToGraph(event);

        graph.setNodeAttribute(draggedNode, "x", pos.x);
        graph.setNodeAttribute(draggedNode, "y", pos.y);

        // Prevent sigma to move camera:
        event.preventSigmaDefault();
        event.original.preventDefault();
        event.original.stopPropagation();
    });

    // On mouse up, we reset the dragging mode
    const handleUp = () => {
        if (draggedNode) {
            graph.removeNodeAttribute(draggedNode, "highlighted");
        }
        isDragging = false;
        draggedNode = null;
    };

    renderer.on("upNode", handleUp);
    renderer.on("upStage", handleUp);


    function setHoveredNode(node?: string) {
        if (isDragging) {
            if (draggedNode) {
                state.hoveredNode = draggedNode;
                state.hoveredNeighbors = new Set(graph.neighbors(draggedNode));
            }
        } else if (node) {
            state.hoovering = true
            state.hoveredNode = node;
            state.hoveredNeighbors = new Set(graph.neighbors(node));
        }


        if (!node) {
            state.hoveredNode = undefined;
            state.hoveredNeighbors = undefined;
        }

        renderer.refresh();
    }

    function setHoveredEdge(edge?: string) {
        state.hoveredEdge = edge;
        if (!edge) {
            state.hoveredEdge = undefined;
        }

        renderer.refresh();
    }

    renderer.on("clickEdge", (event) => {
        const edge = event.edge;
        const edgeData = graph.getEdgeAttributes(edge);

        // Construct the URL with edge-specific information
        const url = `analyze.html?source=${graph.source(edge)}&target=${graph.target(edge)}&files=${edgeData.files}&gravity=${edgeData.gravity}`;

        // Open the URL in a new window or tab
        window.open(url, "_blank");
    });

    renderer.on("enterEdge", (event) => {
        const edge = event.edge;
        const edgeData = graph.getEdgeAttributes(edge);
        state.hoovering = true
        setHoveredEdge(edge);
        // Set tooltip content
        edgeTooltip.innerHTML = `
            <strong>Edge ID:</strong> ${edge}<br />
            <strong>Source:</strong> ${graph.getNodeAttribute(graph.source(edge), "label")}<br />
            <strong>Target:</strong> ${graph.getNodeAttribute(graph.target(edge), "label")}<br />
            <strong>Coupling:</strong> ${edgeData.gravity || "N/A"}<br />
            <strong>Files:</strong> ${edgeData.files || "N/A"}<br />

            
        `;
        edgeTooltip.style.display = "block";
    });

    renderer.on("leaveEdge", () => {
        if(isDragging) return;
        setHoveredEdge(undefined);
        state.hoovering = false;

        edgeTooltip.style.display = "none";
        renderer.refresh();
    });

    renderer.on("enterNode", ({ node }) => {

        setHoveredNode(node);
        setHoveredEdge(undefined);
    });

    renderer.on("leaveNode", () => {
        if(isDragging) return;
        setHoveredNode(undefined);
        state.hoovering = false;
        renderer.refresh();

    });

    // Edge Reducer
    renderer.setSetting("edgeReducer", (edge, data) => {
        debugger;

        const res: Partial<EdgeDisplayData> = {
            ...data,
            label: data.label,
            color: data.color,
        };

        // Get the gravity value associated with the edge (between 0 and 1)
        // const gravity = graph.getEdgeAttribute(edge, "gravity");
        const gravity = data.gravity
        res.size = calculateEdgeSize(edge, graph);  // Assign the calculated edge size


        // Color the edge based on the gravity value
        if (gravity !== undefined) {
            res.color = colorScale(gravity);
        } else {
            res.color = data.color; // Default color if no gravity value
        }


        if (state.hoovering) {
            if(state.hoveredEdge) {
                // Highlight hovered edge
                if (state.hoveredEdge === edge) {
                    res.size = (res.size || 1) * 1.5; // Make edge bigger when hovered
                    res.zIndex = 1; // Bring to front
                } else if (state.hoveredEdge !== edge) {
                    res.size = res.size || 1;
                    res.zIndex = 0;
                    res.color = "#f0f0f0";

                }
            }

            // If the hovered node is not connected to the edge, hide it
            if (
                state.hoveredNode && !graph.extremities(edge).every((n) => n === state.hoveredNode || graph.areNeighbors(n, state.hoveredNode))
            ) {
                res.hidden = true;
                res.label = "";
                res.color = "#f0f0f0";
            }
        }

        if (
            state.suggestions &&
            (!state.suggestions.has(graph.source(edge)) || !state.suggestions.has(graph.target(edge)))
        ) {
            res.hidden = true;
        }


        return res;
    });

    // Node Reducer
    renderer.setSetting("nodeReducer", (node, data) => {
        const res: Partial<NodeDisplayData> = {
            ...data,
            label: data.label,
            color: data.color,
        };
        res.size = 20;
        res.color =nodeColor;
        if (state.hoovering){
            // If the node is hovered, highlight it
            if (state.hoveredNode === node) {
                res.highlighted = true;
                res.zIndex = 1;
            } else {
                res.highlighted = false;
                res.zIndex = 0;
            }

            // If the node is part of the hovered edge, highlight it

            if (state.hoveredEdge) {
                if (graph.source(state.hoveredEdge) === node || graph.target(state.hoveredEdge) === node) {
                    res.highlighted = true;
                } else {
                    res.label = "";
                    res.color = "#f6f6f6";
                }
            }


            // If the node is part of a hovered neighbor, highlight it
            if (state.hoveredNeighbors && state.hoveredNeighbors.has(node)) {
                res.highlighted = true;
            }
            if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
                res.label = "";
                res.color = "#f6f6f6";
            }


        }
        if (state.selectedNode === node) {
            res.highlighted = true;
        }
        else if (state.suggestions) {
            if (state.suggestions.has(node)) {
                res.forceLabel = true;
            } else {
                res.label = "";
                res.color = "#f6f6f6";
            }
        }

        return res;
    });

    // Mouse move event for tooltip positioning
    renderer.getMouseCaptor().on("mousemove", (event) => {
        if (edgeTooltip.style.display === "block") {
            const offsetX = window.scrollX || document.documentElement.scrollLeft;
            const offsetY = window.scrollY || document.documentElement.scrollTop;

            edgeTooltip.style.left = `${event.x + offsetX + 10}px`;
            edgeTooltip.style.top = `${event.y + offsetY + 10}px`;
        }
    });

    // Feed the datalist autocomplete values:
    searchSuggestions.innerHTML = graph
        .nodes()
        .map((node) => `<option value="${graph.getNodeAttribute(node, "label")}"></option>`)
        .join("\n");

    // Actions:
    function setSearchQuery(query: string) {
        state.searchQuery = query;

        if (searchInput.value !== query) searchInput.value = query;

        if (query) {
            const lcQuery = query.toLowerCase();
            const suggestions = graph
                .nodes()
                .map((n) => ({ id: n, label: graph.getNodeAttribute(n, "label") as string }))
                .filter(({ label }) => label.toLowerCase().includes(lcQuery));

            if (suggestions.length === 1 && suggestions[0].label === query) {
                state.selectedNode = suggestions[0].id;
                state.suggestions = undefined;

                const nodePosition = renderer.getNodeDisplayData(state.selectedNode) as Coordinates;
                renderer.getCamera().animate(nodePosition, {
                    duration: 500,
                });
            } else {
                state.selectedNode = undefined;
                state.suggestions = new Set(suggestions.map(({ id }) => id));
            }
        } else {
            state.selectedNode = undefined;
            state.suggestions = undefined;
        }

        renderer.refresh();
    }

    // Bind search input interactions:
    searchInput.addEventListener("input", () => {
        setSearchQuery(searchInput.value || "");
    });
    searchInput.addEventListener("blur", () => {
        setSearchQuery("");
    });

    return () => {
        renderer.kill();
    };
};

window.onload = () => {
    initializeGraph(); // Calls the function when page is fully loaded
};
