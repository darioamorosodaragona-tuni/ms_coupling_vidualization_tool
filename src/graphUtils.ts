import Graph from "graphology";
import * as d3 from "d3";

import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";

import {Coordinates, EdgeDisplayData, NodeDisplayData, SigmaNodeEventPayload} from "sigma/types";

const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);
export interface ToolTipHTMLElements {
    edgeTooltip?: HTMLDivElement;
    contentFunction? : (edge: string, graph: Graph)   => string;
}

export interface SearchHTMLElements {
    searchSuggestions : HTMLDataListElement;
    searchInput : HTMLInputElement
}
export interface State {
    hoveredNode?: string;
    hoveredEdge?: string;
    searchQuery: string;
    selectedNode?: string;
    suggestions?: Set<string>;
    hoveredNeighbors?: Set<string>;
    hoovering?: boolean;
    isDragging?: boolean;
    draggedNode?: string | null;
}

export class Options{
    draggingMode: boolean;
    hooveringEdge: boolean;
    hooveringNode: boolean;
    searchBar: boolean;
    colorBasedOnGravity: boolean;
    state : State;
    renderer: Sigma;
    graph: Graph;
    toolTipHTMLElements: ToolTipHTMLElements;
    searchHTMLElements: SearchHTMLElements;
    toolTip: boolean;
    edgeSizeBasedOn: ( (edge: string, graph: Graph) => number) | undefined  ;


    constructor(state: State, renderer: Sigma, graph: Graph, toolTipHTMLElements : ToolTipHTMLElements, searchHTMLElements : SearchHTMLElements, draggingMode:boolean = true, hooveringEdge:boolean = true, hooveringNode :boolean = true, searchBar: boolean = true, colorBasedOnGravity: boolean = true, toolTip: boolean = true, edgeSizeBasedOn  : ((string: string, graph: Graph) => number) | undefined = undefined ) {
        this.toolTip = toolTip
        this.draggingMode = draggingMode;
        this.hooveringEdge = hooveringEdge;
        this.hooveringNode = hooveringNode;
        this.searchBar = searchBar;
        this.colorBasedOnGravity = colorBasedOnGravity;
        this.state = state;
        this.graph = graph;
        this.renderer = renderer;
        this.toolTipHTMLElements = toolTipHTMLElements;
        this.searchHTMLElements = searchHTMLElements;
        this.edgeSizeBasedOn = edgeSizeBasedOn;


    }

    apply(){


        if (this.draggingMode)
            this.setDraggingMode()
        if (this.hooveringEdge || this.hooveringNode)
            this.setSelectionOnHoovering()
        if(this.colorBasedOnGravity)
            this.setEdgeColorBasedOnGravity()
        if(this.searchBar)
            this.setSearch()
        if (this.toolTip)
            this.setToolTip()
        if(this.edgeSizeBasedOn)
            this.applyEdgeReducer()

    }
    private setDraggingMode() {
        this.renderer.on("downNode", (e) => {
            this.state.isDragging = true;
            this.state.draggedNode = e.node;
            this.graph.setNodeAttribute(this.state.draggedNode, "highlighted", true);
            if (!this.renderer.getCustomBBox()) this.renderer.setCustomBBox(this.renderer.getBBox());
        });

        // On mouse move, if the drag mode is enabled, we change the position of the draggedNode
        this.renderer.on("moveBody", ({event}) => {
            if (!this.state.isDragging || !this.state.draggedNode) return;

            // Get new position of node
            const pos = this.renderer.viewportToGraph(event);

            this.graph.setNodeAttribute(this.state.draggedNode, "x", pos.x);
            this.graph.setNodeAttribute(this.state.draggedNode, "y", pos.y);

            // Prevent sigma to move camera:
            event.preventSigmaDefault();
            event.original.preventDefault();
            event.original.stopPropagation();
        });

        // On mouse up, we reset the dragging mode
        const handleUp = () => {
            if (this.state.draggedNode) {
                this.graph.removeNodeAttribute(this.state.draggedNode, "highlighted");
            }
            this.state.isDragging = false;
            this.state.draggedNode = null;
        };

        this.renderer.on("upNode", handleUp);
        this.renderer.on("upStage", handleUp);

        return this.renderer;
    }

    private setColor(data: any, res: Partial<EdgeDisplayData>) {
        const gravity = data.gravity

        // Color the edge based on the gravity value
        if (gravity !== undefined) {
            res.color = colorScale(gravity);
        } else {
            res.color = data.color;
        }
    }

    private applyNodeReducer(){
        this.renderer.setSetting("nodeReducer", (node, data) => {
            const res: Partial<NodeDisplayData> = {
                ...data,
                label: data.label,
                color: data.color,
            };


            if(this.hooveringNode && this.state) {
                if (this.state.hoovering) {
                    // If the node is hovered, highlight it
                    if (this.state.hoveredNode === node) {
                        res.highlighted = true;
                        res.zIndex = 1;
                    } else {
                        res.highlighted = false;
                        res.zIndex = 0;
                    }
                    // If the node is part of a hovered neighbor, highlight it
                    if (this.state.hoveredNeighbors && this.state.hoveredNeighbors.has(node)) {
                        res.highlighted = true;
                    }
                    if (this.state.hoveredNeighbors && !this.state.hoveredNeighbors.has(node) && this.state.hoveredNode !== node) {
                        res.label = "";
                        res.color = "#f6f6f6";
                    }
                }
            }

            if (this.hooveringEdge && this.state && this.graph){
                if (this.state.hoveredEdge) {
                    if (this.graph.source(this.state.hoveredEdge) === node || this.graph.target(this.state.hoveredEdge) === node) {
                        res.highlighted = true;
                    } else {
                        res.label = "";
                        res.color = "#f6f6f6";
                    }
                }
            }


            if(this.searchBar && this.state ) {
                if (this.state.selectedNode === node) {
                    res.highlighted = true;
                } else if (this.state.suggestions) {
                    if (this.state.suggestions.has(node)) {
                        res.forceLabel = true;
                    } else {
                        res.label = "";
                        res.color = "#f6f6f6";
                    }
                }
            }

            return res;
        });
    }
    private applyEdgeReducer(){
        this.renderer.setSetting("edgeReducer", (edge, data) => {
            const res: Partial<EdgeDisplayData> = {
                ...data,
                label: data.label,
                color: data.color,
            };

            if(this.edgeSizeBasedOn){
                res.size = this.edgeSizeBasedOn(edge, this.graph);  // Assign the calculated edge size
            }

            if (this.colorBasedOnGravity){
                this.setColor(data, res)
            }

            if (this.hooveringEdge && this.state && this.graph) {
                if (this.state.hoovering) {
                    if (this.state.hoveredEdge) {
                        // Highlight hovered edge
                        if (this.state.hoveredEdge === edge) {
                            res.size = (res.size || 1) * 1.5; // Make edge bigger when hovered
                            res.zIndex = 1; // Bring to front
                        } else if (this.state.hoveredEdge !== edge) {
                            res.size = res.size || 1;
                            res.zIndex = 0;
                            res.color = "#f0f0f0";

                        }
                    }
                }
            }

            // If the hovered node is not connected to the edge, hide it
            if(this.hooveringNode && this.state && this.graph && this.state.hoovering) {
                if (
                    this.state.hoveredNode && !this.graph.extremities(edge).every((n) => n === this.state.hoveredNode || this.graph.areNeighbors(n, this.state.hoveredNode))
                ) {
                    res.hidden = true;
                    res.label = "";
                    res.color = "#f0f0f0";
                }
            }
            if (this.searchBar) {
                if (
                    this.state.suggestions &&
                    (!this.state.suggestions.has(this.graph.source(edge)) || !this.state.suggestions.has(this.graph.target(edge)))
                ) {
                    res.hidden = true;
                }
            }
            return res;
        });
    }

    // this.renderer.on("enterEdge", (event) => {
    // const edge = event.edge;
    // this.state.hoovering = true
    // setHoveredEdge(this.renderer,this.state, this.graph, edge);
    // Set tooltip content

// });

//     this.renderer.on("leaveEdge", () => {
//     if(isDragging) return;
//     this.setHoveredEdge(this.renderer, this.state, this.graph, undefined);
//     this.state.hoovering = false;
//
//     this.renderer.refresh();
// });

    private applyOnLeaveEdge(){
       this.renderer.on("leaveEdge", () => {
           if(this.draggingMode) {
               if (this.state.isDragging) return;
           }
           if(this.hooveringEdge) {
               this.setHoveredEdge(this.renderer, this.state, this.graph, undefined);
               this.state.hoovering = false;
           }

           if(this.toolTip && this.toolTipHTMLElements.edgeTooltip)
               this.toolTipHTMLElements.edgeTooltip.style.display = "none";

           this.renderer.refresh();
        });
    }
    private applyOnEnterEdge(){

        this.renderer.on("enterEdge", (event) => {
            const edge = event.edge;

            if (this.hooveringEdge) {
                this.state.hoovering = true
                this.setHoveredEdge(this.renderer, this.state, this.graph, edge);
            }

            if(this.toolTip){
                if (this.toolTipHTMLElements.contentFunction) {
                    const content = this.toolTipHTMLElements.contentFunction(edge, this.graph);

                    // Set tooltip content
                    if (this.toolTipHTMLElements.edgeTooltip && content) {
                        this.toolTipHTMLElements.edgeTooltip.innerHTML = content;
                        this.toolTipHTMLElements.edgeTooltip.style.display = "block";
                    }
                }
            }
        });

    }
    private setEdgeColorBasedOnGravity() {
      this.applyEdgeReducer();
    }

    private setHoveredEdge(renderer: Sigma, state: State, graph: Graph, edge?: string) {
        state.hoveredEdge = edge;
        if (!edge) {
            state.hoveredEdge = undefined;
        }

        renderer.refresh();
    }
    private setSelectionOnHoovering() {
        this.applyEdgeReducer();
        this.applyNodeReducer();
        this.applyOnEnterEdge();
        this.applyOnLeaveEdge();
        function setHoveredNode(renderer: Sigma, state: State, graph: Graph, node?: string, ) {
            if (state.isDragging) {
                if (state.draggedNode) {
                    state.hoveredNode = state.draggedNode;
                    state.hoveredNeighbors = new Set(graph.neighbors(state.draggedNode));
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



        // this.renderer.on("leaveEdge", () => {
        //     if(isDragging) return;
        //     this.setHoveredEdge(this.renderer, this.state, this.graph, undefined);
        //     this.state.hoovering = false;
        //
        //     this.renderer.refresh();
        // });

        this.renderer.on("enterNode", ({ node }) => {

            setHoveredNode(this.renderer, this.state, this.graph, node);
            this.setHoveredEdge(this.renderer, this.state, this.graph, undefined);
        });

        this.renderer.on("leaveNode", () => {
            if(this.state.isDragging) return;
            setHoveredNode(this.renderer, this.state, this.graph,undefined);
            this.state.hoovering = false;
            this.renderer.refresh();

        });


        // this.renderer.on("enterEdge", (event) => {
        //     const edge = event.edge;
        //     this.state.hoovering = true
        //     this.setHoveredEdge(this.renderer,this.state, this.graph, edge);
        //     // Set tooltip content
        //
        // });

        return this.state
    }

    private setSearch() {

        this.searchHTMLElements.searchSuggestions.innerHTML = this.graph
            .nodes()
            .map((node) => `<option value="${this.graph.getNodeAttribute(node, "label")}"></option>`)
            .join("\n");


        function setSearchQuery(searchHTMLElements: SearchHTMLElements, state: State, graph: Graph, renderer: Sigma, query: string) {
            state.searchQuery = query;

            if (searchHTMLElements.searchInput.value !== query) searchHTMLElements.searchInput.value = query;

            if (query) {
                const lcQuery = query.toLowerCase();
                const suggestions = graph
                    .nodes()
                    .map((n) => ({id: n, label: graph.getNodeAttribute(n, "label") as string}))
                    .filter(({label}) => label.toLowerCase().includes(lcQuery));

                if (suggestions.length === 1 && suggestions[0].label === query) {
                    state.selectedNode = suggestions[0].id;
                    state.suggestions = undefined;

                    const nodePosition = renderer.getNodeDisplayData(state.selectedNode) as Coordinates;
                    renderer.getCamera().animate(nodePosition, {
                        duration: 500,
                    });
                } else {
                    state.selectedNode = undefined;
                    state.suggestions = new Set(suggestions.map(({id}) => id));
                }
            } else {
                state.selectedNode = undefined;
                state.suggestions = undefined;
            }

            renderer.refresh();
        }



        // Bind search input interactions:
        this.searchHTMLElements.searchInput.addEventListener("input", () => {
            setSearchQuery(this.searchHTMLElements, this.state, this.graph, this.renderer, this.searchHTMLElements.searchInput.value || "");
        });
        this.searchHTMLElements.searchInput.addEventListener("blur", () => {
            setSearchQuery(this.searchHTMLElements, this.state, this.graph, this.renderer, "");
        });
    }

    private setToolTip(){
        this.renderer.getMouseCaptor().on("mousemove", (event) => {
            if (this.toolTipHTMLElements.edgeTooltip?.style.display === "block") {
                const offsetX = window.scrollX || document.documentElement.scrollLeft;
                const offsetY = window.scrollY || document.documentElement.scrollTop;

                this.toolTipHTMLElements.edgeTooltip.style.left = `${event.x + offsetX + 10}px`;
                this.toolTipHTMLElements.edgeTooltip.style.top = `${event.y + offsetY + 10}px`;
            }
        });

        this.applyOnEnterEdge()
        this.applyOnLeaveEdge()

    }
}