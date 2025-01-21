/**
 * This example showcases sigma's reducers, which aim to facilitate dynamically
 * changing the appearance of nodes and edges, without actually changing the
 * main graphology data.
 */
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";

import { Coordinates, EdgeDisplayData, NodeDisplayData } from "sigma/types";

import data from "../data/data.json";

function initializeGraph () {
    console.log("Script is running");  // Add this at the top of index.ts

    // Retrieve some useful DOM elements:
    const container = document.getElementById("sigma-container") as HTMLElement;
    console.log(container)
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    console.log(searchInput)
    const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;
    console.log(searchSuggestions)
    // Instantiate sigma:
    const graph = new Graph();
    graph.import(data);
    console.log(data)
    // Graphology provides a easy to use implementation of Force Atlas 2 in a web worker
    const sensibleSettings = forceAtlas2.inferSettings(graph);
    const fa2Layout = new FA2Layout(graph, {
        settings: sensibleSettings,
    });
    const edgeTooltip = document.getElementById("tooltip") as HTMLDivElement;
    edgeTooltip.style.position = "absolute";
    edgeTooltip.style.background = "white";
    edgeTooltip.style.border = "1px solid black";
    edgeTooltip.style.padding = "5px";
    edgeTooltip.style.borderRadius = "3px";
    edgeTooltip.style.display = "none";
    edgeTooltip.style.zIndex = "1000";
    // document.body.appendChild(edgeTooltip);

    console.log("Tooltip style:", edgeTooltip.style);





    fa2Layout.start();


    const renderer = new Sigma(graph, container, {
        enableEdgeEvents: true
        // enableEdgeHoverEvents: true,
        // enableEdgeClickEvents: true,
        // enableEdgeWheelEvents: true,
    });

    fa2Layout.stop();

    renderer.on("enterEdge", (event) => {
        console.log("entering on edge")
        const edge = event.edge;
        const edgeData = graph.getEdgeAttributes(edge);

        // Set tooltip content
        edgeTooltip.innerHTML = `
      <strong>Edge ID:</strong> ${edge}<br />
      <strong>Source:</strong> ${graph.source(edge)}<br />
      <strong>Target:</strong> ${graph.target(edge)}<br />
      <strong>Weight:</strong> ${edgeData.weight || "N/A"}
    `;
        edgeTooltip.style.display = "block";
        console.log(edgeTooltip);
    });

    renderer.on("leaveEdge", () => {
        edgeTooltip.style.display = "none";
    });

    renderer.getMouseCaptor().on("mousemove", (event) => {
        if (edgeTooltip.style.display === "block") {
            const offsetX = window.scrollX || document.documentElement.scrollLeft;
            const offsetY = window.scrollY || document.documentElement.scrollTop;

            edgeTooltip.style.left = `${event.x + offsetX + 10}px`;
            edgeTooltip.style.top = `${event.y + offsetY + 10}px`;
        }
    });

    // State for drag'n'drop
    let draggedNode: string | null = null;
    let isDragging = false;

    // On mouse down on a node
    //  - we enable the drag mode
    //  - save in the dragged node in the state
    //  - highlight the node
    //  - disable the camera so its state is not updated
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

    // Type and declare internal state:
    interface State {
        hoveredNode?: string;
        searchQuery: string;

        // State derived from query:
        selectedNode?: string;
        suggestions?: Set<string>;

        // State derived from hovered node:
        hoveredNeighbors?: Set<string>;
    }
    const state: State = { searchQuery: "" };

    // Feed the datalist autocomplete values:
    searchSuggestions.innerHTML = graph
        .nodes()
        .map((node) => `<option value="${graph.getNodeAttribute(node, "label")}"></option>`)
        .join("\n");

    console.log(graph.nodes())
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

            // If we have a single perfect match, them we remove the suggestions, and
            // we consider the user has selected a node through the datalist
            // autocomplete:
            if (suggestions.length === 1 && suggestions[0].label === query) {
                state.selectedNode = suggestions[0].id;
                state.suggestions = undefined;

                // Move the camera to center it on the selected node:
                const nodePosition = renderer.getNodeDisplayData(state.selectedNode) as Coordinates;
                renderer.getCamera().animate(nodePosition, {
                    duration: 500,
                });
            }
            // Else, we display the suggestions list:
            else {
                state.selectedNode = undefined;
                state.suggestions = new Set(suggestions.map(({ id }) => id));
            }
        }
        // If the query is empty, then we reset the selectedNode / suggestions state:
        else {
            state.selectedNode = undefined;
            state.suggestions = undefined;
        }

        // Refresh rendering
        // You can directly call `renderer.refresh()`, but if you need performances
        // you can provide some options to the refresh method.
        // In this case, we don't touch the graph data so we can skip its reindexation
        renderer.refresh();
    }
    function setHoveredNode(node?: string) {
        if(isDragging){
            if(draggedNode){
            state.hoveredNode = draggedNode;
            state.hoveredNeighbors = new Set(graph.neighbors(draggedNode));
            }
        }

        else if (node) {
            state.hoveredNode = node;
            state.hoveredNeighbors = new Set(graph.neighbors(node));
        }



        if (!node) {
            state.hoveredNode = undefined;
            state.hoveredNeighbors = undefined;
        }

        // Refresh rendering
        renderer.refresh();
    }

    // Bind search input interactions:
    searchInput.addEventListener("input", () => {
        setSearchQuery(searchInput.value || "");
    });
    searchInput.addEventListener("blur", () => {
        setSearchQuery("");
    });

    // Bind graph interactions:
    renderer.on("enterNode", ({ node }) => {
        setHoveredNode(node);
    });
    renderer.on("leaveNode", () => {
        if(isDragging) return;
        setHoveredNode(undefined);
    });

    // Render nodes accordingly to the internal state:
    // 1. If a node is selected, it is highlighted
    // 2. If there is query, all non-matching nodes are greyed
    // 3. If there is a hovered node, all non-neighbor nodes are greyed
    renderer.setSetting("nodeReducer", (node, data) => {

        const res: Partial<NodeDisplayData> = {
            ...data,
            label: data.label,
            color: data.color
        };


        if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
            res.label = "";
            res.color = "#f6f6f6";
        }

        if (state.selectedNode === node) {
            res.highlighted = true;
        } else if (state.suggestions) {
            if (state.suggestions.has(node)) {
                res.forceLabel = true;
            } else {
                res.label = "";
                res.color = "#f6f6f6";
            }
        }

        return res;
    });

    // Render edges accordingly to the internal state:
    // 1. If a node is hovered, the edge is hidden if it is not connected to the
    //    node
    // 2. If there is a query, the edge is only visible if it connects two
    //    suggestions
    renderer.setSetting("edgeReducer", (edge, data) => {
        const res: Partial<NodeDisplayData> = {
            ...data,
            label: data.label,
            color: data.color,
        };

        if (
            state.hoveredNode &&
            !graph.extremities(edge).every((n) => n === state.hoveredNode || graph.areNeighbors(n, state.hoveredNode))
        ) {
            res.hidden = true;
        }

        if (
            state.suggestions &&
            (!state.suggestions.has(graph.source(edge)) || !state.suggestions.has(graph.target(edge)))
        ) {
            res.hidden = true;
        }

        return res;
    });

    return () => {
        renderer.kill();
    };
};

window.onload = () => {
    initializeGraph(); // Calls the function when page is fully loaded
};
