import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import NoverlapLayout from 'graphology-layout-noverlap/worker';
import random from 'graphology-layout/random';

import {EdgeDisplayData} from "sigma/types";
import * as d3 from "d3";
import {Options, SearchHTMLElements, State, ToolTipHTMLElements} from "./graphUtils";
import {PipsMode, PipsType} from "nouislider";
import * as noUiSlider from "nouislider";
import wNumb from "wnumb";

const microserviceColors: Record<string, string> = {};

const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;
const edgeTooltip = document.getElementById("tooltip") as HTMLDivElement;
edgeTooltip.style.position = "absolute";
edgeTooltip.style.background = "white";
edgeTooltip.style.border = "1px solid black";
edgeTooltip.style.padding = "5px";
edgeTooltip.style.borderRadius = "3px";
edgeTooltip.style.display = "none";
edgeTooltip.style.zIndex = "1000";

// Type for the query parameters
interface QueryParams {
    source: string | null;
    target: string | null;
    files: number;
    gravity: number;
}

// Type for the graph data
interface GraphData {
    nodes: Array<{
        key: string;
        attributes: {
            microservice_id: string;
            x: number;
            y: number;
        };
        label: string;
    }>;
    edges: Array<{
        source: string;
        target: string;
        files: number;
        gravity: number;
    }>;
}

// Internal state:

let state: State = { searchQuery: "", hoovering: false};



// Function to get query parameters from the URL
function getQueryParams(): QueryParams {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const target = params.get("target");
    const files = Number(params.get("files"));
    const gravity = Number(params.get("gravity"));
    return { source, target, files, gravity };
}

// Function to validate query parameters
function validateParams(params: QueryParams): boolean {
    return <boolean>(
        params.source &&
        params.target &&
        !isNaN(params.files) &&
        params.files > 0 &&
        !isNaN(params.gravity) &&
        params.gravity >= 0 &&
        params.gravity <= 1
    );
}

// Function to filter the input graph data based on source and target
function filterGraphData(graphData: GraphData, params: QueryParams): GraphData {
    // Create a set of nodes that match the source or target
    const filteredNodes = new Set<string>();

    // Iterate through the edges to find connections between source and target nodes
    const filteredEdges = graphData.edges.filter((edge) => {
        const sourceNode = graphData.nodes.find((node) => node.key === edge.source);
        const targetNode = graphData.nodes.find((node) => node.key === edge.target);

        // Check if both nodes belong to the source or target microservice
        const isSourceValid = sourceNode?.attributes.microservice_id === params.source ||
            sourceNode?.attributes.microservice_id === params.target;
        const isTargetValid = targetNode?.attributes.microservice_id === params.source ||
            targetNode?.attributes.microservice_id === params.target;

        if (isSourceValid && isTargetValid) {
            // Add these nodes to the filtered set
            filteredNodes.add(edge.source);
            filteredNodes.add(edge.target);
            return true;
        }
        return false;
    });

    // Filter nodes to include only those that are part of filteredEdges
    const filteredNodesArray = Array.from(filteredNodes);
    const filteredGraphNodes = graphData.nodes.filter((node) => filteredNodesArray.includes(node.key));

    return {
        nodes: filteredGraphNodes,
        edges: filteredEdges,
    };
}

function filterPips(value: number, type: PipsType) {
    return 1;
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


    slider.updateOptions({
        pips : {mode: PipsMode.Steps, density: 100,
            format: wNumb({
                decimals: 1
            }), filter: filterPips}
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

// Function to generate the graph data
function generateGraphData(filteredData: any, params: QueryParams): Graph {
    const graph = new Graph();


    // Add nodes
    filteredData.nodes.forEach((node: any) => {
        const color = node.attributes.microservice_id === params.source ? "#3498db" : "#db8bfa";
        microserviceColors[node.attributes.microservice_label] = color;

        graph.addNode(node.key, {
            x: node.attributes.x,
            y: node.attributes.y,
            size: 20,
            label: node.attributes.label,
            color: color,
        });
    });

    // Add edges
    filteredData.edges.forEach((edge: any) => {
        graph.addEdge(edge.source, edge.target, {
            files: edge.attributes.files,
            gravity: edge.attributes.gravity,
            color: "#FEF0D9",
            size: 3 // Normalize edge size
        });
    });

    return graph;
}

function populateLegend(microserviceColors: Record<string, string>) {
    const legendContainer = document.getElementById("legend-items")!;
    legendContainer.innerHTML = ""; // Clear existing legend items

    Object.entries(microserviceColors).forEach(([microserviceId, color]) => {
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";

        const colorBox = document.createElement("div");
        colorBox.className = "legend-color";
        colorBox.style.backgroundColor = color;

        const label = document.createElement("span");
        label.textContent = `Microservice ${microserviceId}`;

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

// Function to populate the color scale legend
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
// Main function to render the graph
(async function () {
    let draggedNode: string | null = null;
    let isDragging = false;

    const params = getQueryParams();

    if (!validateParams(params)) {
        document.getElementById("error-message")!.style.display = "block";
        return;
    }

    // Fetch the graph data from JSON
    const response = await fetch("/data/ms_files.json");
    const graphData: GraphData = await response.json();

    // Filter the graph data dynamically based on the query parameters
    const filteredData = filterGraphData(graphData, params);

    // Generate graph data dynamically
    const graph = generateGraphData(filteredData, params);

    populateLegend(microserviceColors);
    populateColorScaleLegend()

// Start the algorithm:
    const sensibleSettings = forceAtlas2.inferSettings(graph);
    sensibleSettings.gravity = 2
    sensibleSettings.strongGravityMode = true
    const fa2Layout = new FA2Layout(graph, {
        settings: sensibleSettings
    });

    fa2Layout.start();

    // Create Sigma renderer
    const container = document.getElementById("sigma-container")!;
    const renderer = new Sigma(graph, container ,{
        enableEdgeEvents: true
    });

    setupGravityFilter(graph, renderer)


    setTimeout(() => {
        fa2Layout.stop();
        renderer.refresh();
    }, 2500);

    const toolTipHtmlElements : ToolTipHTMLElements = {edgeTooltip: edgeTooltip, contentFunction: edgeContentBuilder};
    const searchBarHtmlElements : SearchHTMLElements = {searchInput: searchInput, searchSuggestions: searchSuggestions};


    const  customOptions : Options = new Options(state, renderer, graph, toolTipHtmlElements,searchBarHtmlElements)
    customOptions.apply()


    function edgeContentBuilder(edge: string, graph: Graph): string {
        return `
        <strong>Edge ID:</strong> ${edge}<br />
        <strong>Source:</strong> ${graph.getNodeAttribute(graph.source(edge), "label")}<br />
        <strong>Target:</strong> ${graph.getNodeAttribute(graph.target(edge), "label")}<br />
        <strong>Coupling:</strong> ${graph.getEdgeAttribute(edge, "gravity") || "N/A"}<br />
    `;
    }



})();
