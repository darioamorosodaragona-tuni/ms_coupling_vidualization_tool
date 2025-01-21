import {
    calculateEdgeColor,
    calculateEdgeSize,
    initializeDragAndDrop,
    initializeSearchBar, setEdgeReducer,
    setHoveredEdge, setNodeReducer
} from "./graphUtils";
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import data from "../data/ms_data.json";
import {EdgeDisplayData} from "sigma/types";

function initializeGraph() {
    console.log("Script is running");

    // Retrieve some useful DOM elements
    const container = document.getElementById("sigma-container") as HTMLElement;
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;
    const nodeColor = "#FEF0D9"; // Muted blue-gray (modern, sleek color)

    // Instantiate sigma:
    const graph = new Graph();
    graph.import(data);

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

    fa2Layout.start();

    const renderer = new Sigma(graph, container, {
        enableEdgeEvents: true
    });

    // Run the layout for a specified number of iterations or until stable
    setTimeout(() => {
        fa2Layout.stop();
        renderer.refresh();
    }, 5000);

    interface State {
        hoveredNode?: string;
        hoveredEdge?: string;
        searchQuery: string;
        selectedNode?: string;
        suggestions?: Set<string>;
        hoveredNeighbors?: Set<string>;
        hoovering?: boolean
    }

    const state: State = {searchQuery: "", hoovering: false};


    // Initialize drag-and-drop
    initializeDragAndDrop(renderer, graph, state);

    // Initialize search bar
    initializeSearchBar(renderer, graph, searchInput, searchSuggestions, state);

    // Reducer
    setEdgeReducer(renderer, graph, state);

    setNodeReducer(renderer, state, nodeColor, graph);
}

window.onload = () => {
    initializeGraph(); // Calls the function when page is fully loaded
};

