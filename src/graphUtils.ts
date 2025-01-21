import Graph from "graphology";
import * as d3 from "d3";

import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";

import {Coordinates, EdgeDisplayData, NodeDisplayData, SigmaNodeEventPayload} from "sigma/types";
import {State} from "./analyze"

const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);

export class Options{
    draggingMode: boolean;
    hooveringEdge: boolean;
    hooveringNode: boolean;
    searchBar: boolean;
    colorBasedOnGravity: boolean;
    state : State;
    renderer: Sigma;
    graph: Graph;

    constructor(state: State, renderer: Sigma, graph: Graph, draggingMode:boolean, hooveringEdge:boolean, hooveringNode :boolean, searchBar: boolean, colorBasedOnGravity: boolean) {
        this.draggingMode = draggingMode;
        this.hooveringEdge = hooveringEdge;
        this.hooveringNode = hooveringNode;
        this.searchBar = searchBar;
        this.colorBasedOnGravity = colorBasedOnGravity;
        this.state = state;
        this.graph = graph;
        this.renderer = renderer;
    }

    setDraggingMode(renderer: Sigma, isDragging: boolean, draggedNode: string | null, graph: Graph) {
        renderer.on("downNode", (e) => {
            isDragging = true;
            draggedNode = e.node;
            graph.setNodeAttribute(draggedNode, "highlighted", true);
            if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
        });

        // On mouse move, if the drag mode is enabled, we change the position of the draggedNode
        renderer.on("moveBody", ({event}) => {
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

        return {renderer, isDragging, draggedNode}
    }

    setColor(data: any, res: Partial<EdgeDisplayData>) {
        const gravity = data.gravity

        // Color the edge based on the gravity value
        if (gravity !== undefined) {
            res.color = colorScale(gravity);
        } else {
            res.color = data.color;
        }
    }

    applyNodeReducer(){
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
    applyEdgeReducer(){
        this.renderer.setSetting("edgeReducer", (edge, data) => {
            const res: Partial<EdgeDisplayData> = {
                ...data,
                label: data.label,
                color: data.color,
            };

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

    applyOnLeaveEdge(isDragging?: boolean, edgeTooltip?: HTMLDivElement){
       this.renderer.on("leaveEdge", () => {
           if(this.draggingMode) {
               if (isDragging) return;
           }
           if(this.hooveringEdge) {
               this.setHoveredEdge(this.renderer, this.state, this.graph, undefined);
               this.state.hoovering = false;
           }

           if(edgeTooltip)
               edgeTooltip.style.display = "none";

           this.renderer.refresh();
        });
    }
    applyOnEnterEdge(edgeTooltip: HTMLDivElement | undefined, contentBuilder?: (edge: string, graph: Graph)   => string
    ){

        this.renderer.on("enterEdge", (event) => {
            const edge = event.edge;
            const edgeData = this.graph.getEdgeAttributes(edge);

            if(this.hooveringEdge) {
               this.state.hoovering = true
               this.setHoveredEdge(this.renderer, this.state, this.graph, edge);
           }

            if(contentBuilder) {
                const content = contentBuilder(edge, this.graph);

                // Set tooltip content
                if (edgeTooltip && content) {
                    edgeTooltip.innerHTML = content;
                    edgeTooltip.style.display = "block";
                }
            }
        });
    }
    setEdgeColorBasedOnGravity() {
      this.applyEdgeReducer();
    }

    setHoveredEdge(renderer: Sigma, state: State, graph: Graph, edge?: string) {
        state.hoveredEdge = edge;
        if (!edge) {
            state.hoveredEdge = undefined;
        }

        renderer.refresh();
    }
    setSelectionOnHoovering(isDragging: boolean, draggedNode: string | null) {
        this.applyEdgeReducer();
        this.applyNodeReducer()
        this.applyOnEnterEdge(undefined)
        this.applyOnLeaveEdge(isDragging)
        function setHoveredNode(renderer: Sigma, state: State, graph: Graph, node?: string, ) {
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
            if(isDragging) return;
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

    setSearch(searchSuggestions : HTMLDataListElement, searchInput : HTMLInputElement) {

        searchSuggestions.innerHTML = this.graph
            .nodes()
            .map((node) => `<option value="${this.graph.getNodeAttribute(node, "label")}"></option>`)
            .join("\n");


        function setSearchQuery(state: State, graph: Graph, renderer: Sigma, query: string) {
            state.searchQuery = query;

            if (searchInput.value !== query) searchInput.value = query;

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
        searchInput.addEventListener("input", () => {
            setSearchQuery(this.state, this.graph, this.renderer, searchInput.value || "");
        });
        searchInput.addEventListener("blur", () => {
            setSearchQuery(this.state, this.graph, this.renderer, "");
        });
    }

    setToolTip(edgeTooltip: HTMLDivElement, content: (edge: string, graph: Graph)   => string, isDragging?:boolean ){
        this.renderer.getMouseCaptor().on("mousemove", (event) => {
            if (edgeTooltip.style.display === "block") {
                const offsetX = window.scrollX || document.documentElement.scrollLeft;
                const offsetY = window.scrollY || document.documentElement.scrollTop;

                edgeTooltip.style.left = `${event.x + offsetX + 10}px`;
                edgeTooltip.style.top = `${event.y + offsetY + 10}px`;
            }
        });

        this.applyOnEnterEdge(edgeTooltip, content)
        this.applyOnLeaveEdge(isDragging, edgeTooltip)


    }
}