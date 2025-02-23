import Graph from "graphology";
import * as d3 from "d3";

import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";

// import data from "../data/ms_data.json";



import {Options, SearchHTMLElements, State, ToolTipHTMLElements} from "./graphUtils";
import * as noUiSlider from 'nouislider';
import {PipsMode, PipsType} from 'nouislider';
import 'nouislider/dist/nouislider.css';
import wNumb from "wnumb"
import {json} from "d3";

interface QueryParams {
    buildID: string | null;
}
async function loadJSON(url: string, filename: string): Promise<any> {
    const response = await fetch(`${url}/data/${filename}`);
    if (!response.ok) {
        throw new Error(`Failed to load file: ${filename}`);
    }
    return response.json();
}


async function initializeGraphData(url: string, filename: string, graph: Graph) {
    const data = await loadJSON(url,filename);
    graph.import(data);
    return graph;
}

interface Node {
    key: string;
    attributes: {
        x: number;
        y: number;
        size: number;
        label: string;
        createdAt: number;
    };
}

interface Edge {
    key: string;
    source: string;
    target: string;
    attributes: {
        createdAt: number;
        modifiedAt: number;
        files: number;
        gravity: number;
        commit_files: number,
        previous_commit_gravity: number,
        commit_gravity: number,
    };
}

async function initializeGraphData2(url: string, filename: string, graph: Graph) {
    const generalData = await loadJSON(url, "ms_data");
    const buildData = await loadJSON(url,filename);
    const buildDate : number = buildData.buildDate;
    let nodesToTake: Node[] = [];
    let edgesToTake : Edge[] = [];

    generalData.nodes.forEach((node: Node) => {
        if (node.attributes.createdAt <= buildDate) {
            nodesToTake.push(node)
        }
    });

    generalData.edges.forEach((edge: Edge) =>{
        if (edge.attributes.modifiedAt <= buildDate){
            edgesToTake.push(edge)
        }
    });

    // Replace edge data from buildData
    edgesToTake.forEach((edge: Edge, index: number) => {
        const matchingEdgeInBuildData = buildData.edges.find((buildEdge: Edge) => buildEdge.key === edge.key);

        if (matchingEdgeInBuildData) {
            // Replace the edge attributes with the corresponding values from buildData
            edgesToTake[index] = {
                ...edge,
                attributes: {
                    ...edge.attributes,
                    ...matchingEdgeInBuildData.attributes // Overwrite with build data
                }
            };
        }
    });

    graph.clear();

    nodesToTake.forEach((nodeToTake) =>{
        graph.addNode(nodeToTake.key, {
            x: nodeToTake.attributes.x,
            y: nodeToTake.attributes.y,
            size: 20,
            label: nodeToTake.attributes.label,
            color: "#FEF0D9",
        });
    })

    edgesToTake.forEach((edgeToTake)=>{
        graph.addEdge(edgeToTake.source, edgeToTake.target, {
            files: edgeToTake.attributes.files,
            gravity: edgeToTake.attributes.gravity,
            color: "#FEF0D9",
            size: 3,
            commit_files: edgeToTake.attributes.commit_files,
            previous_commit_gravity: edgeToTake.attributes.previous_commit_gravity,
            commit_gravity: edgeToTake.attributes.commit_gravity
        });
    });


    return graph;
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
function initializeGraph(graph: Graph, commitBuild: boolean) {
    console.log("Script is running");

    // Retrieve some useful DOM elements:
    const container = document.getElementById("sigma-container") as HTMLElement;
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;
    const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);



    document.addEventListener("DOMContentLoaded", () => {


    });



    graph.forEachNode((node, attributes) => {
        // Custom logic to determine the size
        // For example, size based on a specific attribute:
        const size = 20; // Scale size (adjust the multiplier as needed)

        // Update the node's size attribute
        graph.setNodeAttribute(node, "size", size);
        graph.setNodeAttribute(node, "color", "#3498db");

    });

    // Set uniform color for all nodes (elegant muted color)
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
        return commitBuild ? ` <strong>Edge ID:</strong> ${edge}<br />
        <strong>Source:</strong> ${graph.getNodeAttribute(graph.source(edge), "label")}<br />
        <strong>Target:</strong> ${graph.getNodeAttribute(graph.target(edge), "label")}<br />
        <strong>Previous Coupling:</strong> ${graph.getEdgeAttribute(edge, "previous_commit_gravity") || "N/A"}<br />
        <strong>New Coupling:</strong> ${graph.getEdgeAttribute(edge, "commit_gravity") || "N/A"}<br />
        <strong>Files:</strong> ${graph.getEdgeAttribute(edge, "commit_files") || "N/A"}<br /> ` :
            `
     <strong>Edge ID:</strong> ${edge}<br />
    <strong>Source:</strong> ${graph.getNodeAttribute(graph.source(edge), "label")}<br />
    <strong>Target:</strong> ${graph.getNodeAttribute(graph.target(edge), "label")}<br />
    <strong>Coupling:</strong> ${graph.getEdgeAttribute(edge, "gravity") || "N/A"}<br />
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

function toggleSelection(dataBaseUrl: string, graph: Graph, selectedOption: string, option1: HTMLElement, option2: HTMLElement, filename:string) {
    if (selectedOption === "option1" && option1 && option2) {
        option1.classList.add("active");
        option2.classList.remove("active");
        console.log("Option 1 selected");

        // initializeGraphData2(dataBaseUrl, filename, graph)

        const url = `${window.location.pathname}?buildId=${filename.replace(".json", "")}&commitView=true`;


        console.log("url", url);
        window.location.href = url;

    } else if (selectedOption === "option2" && option1 && option2) {
        option2.classList.add("active");
        option1.classList.remove("active");
        console.log("Option 2 selected");
        // Add logic for Option 2
        const url = `${window.location.pathname}?buildId=${filename.replace(".json", "")}&commitView=false`;
        console.log("url", url);
        window.location.href = url;
    }
}
window.addEventListener("DOMContentLoaded", () => {
    // Initialize the graph and load initial data based on the URL parameters
    const graph = new Graph();
    const buildId = new URLSearchParams(window.location.search).get("buildId");
    let var1 = new URLSearchParams(window.location.search).get("commitView")
    let commitToggle = true
    if(var1 !== null) {
        if (var1 === "true")
            commitToggle = true
        if (var1 === "false")
            commitToggle = false
    }
    const filename = buildId ? `${buildId}` : "ms_data";
    let commitBuild = !!buildId;



    // Dynamically load the common content, including the dropdown
    // Determine base URL dynamically
    const dataBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://ms-coupling-visualization-tool.onrender.com';

// Fetch the content of common.html and populate the page
    fetch(`${dataBaseUrl}/commonHtmlPage`)
        .then(response => response.text())
        .then(data => {
            // Insert the dynamic content into the page
            const commonContent = document.getElementById('common-content')!;
            commonContent.innerHTML += data;

            // Now, populate the dropdown with file data
            const dropdown = document.getElementById("file-dropdown") as HTMLSelectElement;

            if (dropdown) {
                if (commitBuild)
                    if (buildId)
                        dropdown.value = buildId;
                fetch(`${dataBaseUrl}/builds`)  // Use dynamic base URL here
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(`Failed to fetch builds: ${response.statusText}`);
                        }
                        return response.json(); // Parse JSON response
                    })
                    .then((files: string[]) => {
                        console.log("Available files:", files);
                        // Populate dropdown with file names
                        files.forEach((file) => {
                            const option = document.createElement("option");
                            option.value = file.replace(".json", "");
                            option.textContent = file.replace(".json", "");
                            dropdown.appendChild(option);
                        });
                        console.log("Dropdown populated successfully.");
                    })
                    .catch((error) => {
                        console.error("Error loading files:", error);
                    });
            }

            if(commitBuild){

                const option1 = document.getElementById("option-1");
                const option2 = document.getElementById("option-2");

                if (option1 && option2) {
                    // Add event listeners to both options
                    option1.addEventListener("click", () => toggleSelection(dataBaseUrl, graph, "option1", option1, option2, filename));
                    option2.addEventListener("click", () => toggleSelection(dataBaseUrl, graph,"option2", option1, option2, filename));
                }

                if (commitToggle && commitBuild) {
                    option1!.classList.add("active");
                    option2!.classList.remove("active");
                } else if (commitBuild && !commitToggle) {
                    option1!.classList.remove("active");
                    option2!.classList.add("active");
                }


            } else{
                document.getElementById("toggle-menu")!.style.display = "none";
            }

            if(!commitToggle && commitBuild) {
                // Initialize graph data first
                initializeGraphData2(dataBaseUrl, filename, graph)
                    .then((graph) => {
                        // Once graph data is loaded, initialize the graph
                        initializeGraph(graph, commitBuild);
                    })
                    .catch((error) => {
                        console.error("Error loading graph data:", error);
                    });
            }
            else {
                // Initialize graph data first
                initializeGraphData(dataBaseUrl, filename, graph)
                    .then((graph) => {
                        // Once graph data is loaded, initialize the graph
                        initializeGraph(graph, commitBuild);
                    })
                    .catch((error) => {
                        console.error("Error loading graph data:", error);
                    });
            }

            // Handle the "View" button click event
            const viewButton = document.getElementById("view-button") as HTMLButtonElement;
            if (viewButton) {
                viewButton.addEventListener("click", () => {
                     const selectedFile = dropdown?.value;
                    if (!selectedFile) {
                        alert("Please select a file!");
                        return;
                    }

                    // Fetch and display the selected JSON file
                    fetch(`${dataBaseUrl}/data/${selectedFile}`)
                        .then((response) => response.json())
                        .then((data) => {
                            console.log("Selected file data:", data);
                            // alert(`Loaded file: ${selectedFile}`);
                            const url = `${window.location.pathname}?buildId=${selectedFile.replace(".json", "")}`;
                            console.log("url", url);

                            // Open the URL in a new window or tab
                            window.open(url, "_blank");

                        })
                        .catch((error) => console.error("Error loading file:", error));
                });
            }
        })
        .catch((error) => {
            console.error("Error loading common content:", error);
        });
});



