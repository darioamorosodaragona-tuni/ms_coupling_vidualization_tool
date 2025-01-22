import Graph from "graphology";
import * as d3 from "d3";

import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";

import data from "../data/ms_data.json";
import {Options, SearchHTMLElements, State, ToolTipHTMLElements} from "./graphUtils";
import * as noUiSlider from 'nouislider';
import {PipsMode, PipsType} from 'nouislider';
import 'nouislider/dist/nouislider.css';
import wNumb from "wnumb"

function filterPips(value: number, type: PipsType) {
    debugger;
    if (type === 0) {
        // Show big pips at every 0.1
        let v = value % 0.1 === 0 ? 1 : 0;
        return v
    }
    if (type === 1 || type === 2) {
        // Show small pips at every 0.05
        let v = value % 0.05 === 0 ? 2 : -1
        return v; // Return -1 to hide other pips
    }
    return -1; // Hide all other pips
}
function setupGravityFilter(graph: Graph, renderer: Sigma) {
    const sliderElement = document.getElementById("gravity-range") as HTMLElement;
    const minGravity = document.getElementById("min-gravity") as HTMLSpanElement;
    const maxGravity = document.getElementById("max-gravity") as HTMLSpanElement;
    // Initialize noUiSlider
    const slider = noUiSlider.create(sliderElement, {
        start: [0, 1], // Initial range values
        connect: true,
        behaviour: 'drag',
        range: {
            min: 0,
            max: 1,
        },
        step: 0.1
    });


    // slider.updateOptions({
    //     pips : {mode: PipsMode.Steps, density: 1,
    //         format: wNumb({
    //             decimals: 1
    //         }), filter: filterPips}
    // }, true)

    slider.updateOptions({
        pips : {mode: PipsMode.Steps, density: 100,
            format: wNumb({
                decimals: 1
            })}
    }, true)




    // Listen for updates
    slider.on("update", (values) => {
        const [min, max] = values.map((v) => parseFloat(String(v)));
        // minGravity.textContent = min.toFixed(1);
        // maxGravity.textContent = max.toFixed(1);

        // Filter the graph based on the range
        filterGraphByGravity(graph, min, max);
        renderer.refresh();
    });
}

function filterGraphByGravity(graph: Graph, min: number, max: number) {
    graph.forEachNode((node) => {
        const edges = graph.edges(node);
        const hasValidEdge = edges.some((edge) => {
            const gravity = graph.getEdgeAttribute(edge, "gravity");
            return gravity >= min && gravity <= max;
        });

        // Show/hide the node based on whether it has valid edges
        graph.setNodeAttribute(node, "hidden", !hasValidEdge);
    });

    graph.forEachEdge((edge) => {
        const gravity = graph.getEdgeAttribute(edge, "gravity");
        const isVisible = gravity >= min && gravity <= max;

        // Show/hide the edge
        graph.setEdgeAttribute(edge, "hidden", !isVisible);
    });
}


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
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;
    const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);

    // Instantiate sigma:
    const graph = new Graph();

    graph.import(data);

    graph.forEachNode((node, attributes) => {
        // Custom logic to determine the size
        // For example, size based on a specific attribute:
        const size = 20; // Scale size (adjust the multiplier as needed)

        // Update the node's size attribute
        graph.setNodeAttribute(node, "size", size);
        graph.setNodeAttribute(node, "color", "#3498db");

    });

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


    setupGravityFilter(graph, renderer);

    // Run the layout for a specified number of iterations or until stable
    setTimeout(() => {
        fa2Layout.stop();
        renderer.refresh();
    }, 5000);

    // State for drag'n'drop


    // Internal state:

    const state: State = { searchQuery: "", hoovering: false};
    function edgeContentBuilder(edge: string, graph: Graph): string {
        return `
        <strong>Edge ID:</strong> ${edge}<br />
    <strong>Source:</strong> ${graph.getNodeAttribute(graph.source(edge), "label")}<br />
    <strong>Target:</strong> ${graph.getNodeAttribute(graph.target(edge), "label")}<br />
    <strong>Coupling:</strong> ${graph.getEdgeAttribute(edge, "gravity")|| "N/A"}<br />
    <strong>Files:</strong> ${graph.getEdgeAttribute(edge, "files") || "N/A"}<br /> 
    `;
    }


    const toolTipHtmlElements : ToolTipHTMLElements = {edgeTooltip: edgeTooltip, contentFunction: edgeContentBuilder};
    const searchBarHtmlElements : SearchHTMLElements = {searchInput: searchInput, searchSuggestions: searchSuggestions};


    const  opt : Options = new Options(state, renderer, graph, toolTipHtmlElements,searchBarHtmlElements,true, true, true, true,true, true, calculateEdgeSize)
    opt.apply()


    renderer.on("clickEdge", (event) => {
        const edge = event.edge;
        const edgeData = graph.getEdgeAttributes(edge);

        // Construct the URL with edge-specific information
        const url = `analyze.html?source=${graph.source(edge)}&target=${graph.target(edge)}&files=${edgeData.files}&gravity=${edgeData.gravity}`;

        // Open the URL in a new window or tab
        window.open(url, "_blank");
    });


    return () => {
        renderer.kill();
    };
}

window.onload = () => {
    initializeGraph(); // Calls the function when page is fully loaded
};
