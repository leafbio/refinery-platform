/**
 * Module for layout.
 */
var provvisLayout = function () {

    /**
     * Maps the column/row index to nodes.
     * @param parent The parent node.
     */
    var initNodeGrid = function (parent) {
        var grid = [];

        for (var i = 0; i < parent.l.depth; i++) {
            grid.push([]);
            for (var j = 0; j < parent.l.width; j++) {
                grid[i][j] = "undefined";
            }
        }

        parent.l.grid = grid;
    };

    /**
     * Generic implementation for the linear time topology sort [Kahn 1962] (http://en.wikipedia.org/wiki/Topological_sorting).
     * @param startNodes Array containing the starting nodes.
     * @param nodesLength Size of the nodes array.
     * @param parent The parent node.
     * @returns {Array} Topology sorted array of nodes.
     */
    var topSortNodes = function (startNodes, nodesLength, parent) {
        var sortedNodes = [];

        /* For each successor node. */
        var handleSuccessorNodes = function (curNode) {

            /* When the analysis layout is computed, links occur between dummy nodes (Analysis) and Nodes or Analysis.
             * In order to distinct both cases, the connection between dummy nodes and nodes is preserved by saving
             * the id of a node rather than its parent analysis id. */
            if (curNode instanceof provvisDecl.Node && parent instanceof provvisDecl.ProvGraph) {
                curNode = curNode.parent.parent;
            }

            /* Get successors. */
            curNode.succs.values().filter(function (s) {
                return s.parent === null || s.parent === parent || curNode.uuid === "dummy";
            }).forEach(function (succNode) {
                if (succNode instanceof provvisDecl.Node && parent instanceof provvisDecl.ProvGraph) {
                    succNode = succNode.parent.parent;
                }

                /* Mark edge as removed. */
                succNode.predLinks.values().forEach(function (predLink) {

                    /* When pred node is of type dummy, the source node directly is an analysis. */
                    var predLinkNode = null;
                    if (curNode instanceof provvisDecl.Analysis) {
                        if (predLink.source instanceof provvisDecl.Analysis) {
                            predLinkNode = predLink.source;
                        } else {
                            predLinkNode = predLink.source.parent.parent;
                        }
                    } else if (curNode instanceof provvisDecl.Node) {
                        predLinkNode = predLink.source;
                    }

                    if (predLinkNode && predLinkNode.autoId === curNode.autoId) {
                        predLink.l.ts.removed = true;
                    }
                });

                /* When successor node has no other incoming edges,
                 insert successor node into result set. */
                if (!succNode.predLinks.values().some(function (predLink) {
                        return !predLink.l.ts.removed;
                    }) && !succNode.l.ts.removed) {
                    startNodes.push(succNode);
                    succNode.l.ts.removed = true;
                }
            });
        };

        /* While the input set is not empty. */
        var i = 0;
        while (i < startNodes.length && i < nodesLength) {

            /* Remove first item. */
            var curNode = startNodes[i];

            /* And push it into result set. */
            sortedNodes.push(curNode);
            curNode.l.ts.removed = true;

            /* Get successor nodes for current node. */
            handleSuccessorNodes(curNode);
            i++;
        }

        /* Handle cyclic graphs. */
        /* TODO: Review condition. */
        if (startNodes.length > nodesLength) {
            return null;
        } else {
            return sortedNodes;
        }
    };

    /**
     * Assign layers.
     * @param tsNodes Topology sorted nodes.
     * @param parent The parent node.
     */
    var layerNodes = function (tsNodes, parent) {
        var layer = 0,
            preds = [];

        tsNodes.forEach(function (n) {

            /* Get incoming predecessors. */
            n.preds.values().filter(function (p) {
                if (p.parent === parent) {
                    preds.push(p);
                } else if (p instanceof provvisDecl.Node && parent instanceof provvisDecl.ProvGraph) {
                    preds.push(p.parent.parent);
                }
            });

            if (preds.length === 0) {
                n.col = layer;
            } else {
                var minLayer = layer;
                preds.forEach(function (p) {
                    if (p.col > minLayer) {
                        minLayer = p.col;
                    }
                });
                n.col = minLayer + 1;
            }
        });
    };

    /**
     * Group nodes by layers into a 2d array.
     * @param tsNodes Topology sorted nodes.
     * @returns {Array} Layer grouped nodes.
     */
    var groupNodes = function (tsNodes) {
        var layer = 0,
            lgNodes = [];

        lgNodes.push([]);

        var k = 0;
        tsNodes.forEach(function (n) {
            if (n.col === layer) {
                lgNodes[k].push(n);
            } else if (n.col < layer) {
                lgNodes[n.col].push(n);
            } else {
                k++;
                layer++;
                lgNodes.push([]);
                lgNodes[k].push(n);
            }
        });

        return lgNodes;
    };

    /**
     * Reorder subanalysis layout to minimize edge crossings.
     * @param bclgNodes Barcyenter sorted, layered and grouped analysis nodes.
     */
    var reorderSubanalysisNodes = function (bclgNodes, cell) {

        /* Initializations. */
        bclgNodes.forEach(function (l) {
            l.forEach(function (an) {

                /* Initialize analysis dimensions. */
                an.l.depth = 1;
                an.l.width = an.children.size();

                /* Create grid for subanalyses. */
                initNodeGrid(an);

                /* List which contains the subanalysis to reorder afterwards. */
                var colList = [];

                /* Initialize subanalysis col and row attributes. */
                an.children.values().forEach(function (san, j) {

                    /* Only one column does exist in this view. */
                    san.col = 0;
                    san.row = j;

                    /* The preceding analysis marks the fixed layer. */
                    if (!an.preds.empty()) {

                        /* Barycenter ordering. */
                        var degree = 1,
                            accRows = 0,
                            usedCoords = [],
                            delta = 0;

                        degree = san.preds.size();

                        /* Accumulate san row as well as an row for each pred. */
                        san.preds.values().forEach(function (psan) {
                            accRows += psan.row + ((psan.parent.row) ? psan.parent.row : 0);
                        });

                        /* If any subanalysis within the analysis has the same barycenter value, increase it by a small value. */
                        if (usedCoords.indexOf(accRows / degree) === -1) {
                            san.l.bcOrder = accRows / degree;
                            usedCoords.push(accRows / degree);
                        } else {
                            san.l.bcOrder = accRows / degree + delta;
                            usedCoords.push(accRows / degree + delta);
                            delta += 0.01;
                        }

                        /* Push into array to reorder afterwards. */
                        colList.push(san);
                    }

                });

                /* Sort subanalysis nodes. */
                colList.sort(function (a, b) {
                    return a.l.bcOrder - b.l.bcOrder;
                });

                /* Reorder subanalysis nodes. */
                colList.forEach(function (d, j) {
                    d.row = j;
                });

                /* Set grid. */
                an.children.values().forEach(function (san) {
                    /* Set grid cell. */
                    an.l.grid[san.col][san.row] = san;
                });

                /* Set coords. */
                an.children.values().forEach(function (san) {
                    /* Set grid cell. */
                    san.x = san.col * cell.width;
                    san.y = san.row * cell.height;
                });

                /* Reset reorder list. */
                colList = [];
            });
        });
    };

    /**
     * Reorder workflow nodes to minimize edge crossings.
     * @param gNodes Topology sorted, layered and grouped nodes.
     * @param san Parent subanalysis.
     */
    var reorderWFNodes = function (gNodes, san) {

        /* Initializations. */
        gNodes.forEach(function (l,i) {

            /* List which contains the nodes to reorder afterwards. */
            var colList = [];
            l.forEach(function (n,j) {
                n.col = i;
                n.row = j;

                /* The preceding nodes marks the fixed layer. */
                if (!n.preds.empty()) {

                    /* Barycenter ordering. */
                    var degree = 1,
                        accRows = 0,
                        usedCoords = [],
                        delta = 0;

                    degree = n.preds.size();

                    /* Accumulate san row as well as an row for each pred. */
                    n.preds.values().forEach(function (pn) {
                        accRows += pn.row + ((pn.parent.row) ? pn.parent.row : 0);
                    });

                    /* If any node within the workflow has the same barycenter value, increase it by a small value. */
                    if (usedCoords.indexOf(accRows / degree) === -1) {
                        n.l.bcOrder = accRows / degree;
                        usedCoords.push(accRows / degree);
                    } else {
                        n.l.bcOrder = accRows / degree + delta;
                        usedCoords.push(accRows / degree + delta);
                        delta += 0.01;
                    }
                }
                /* Push into array to reorder afterwards. */
                colList.push(n);
            });

            /* Sort subanalysis nodes. */
            colList.sort(function (a, b) {
                return a.l.bcOrder - b.l.bcOrder;
            });

            /* Reorder subanalysis nodes. */
            colList.forEach(function (d, j) {
                d.row = j;
            });

            gNodes[i] = colList;

            /* Reset reorder list. */
            colList = [];
        });

        /* Initialize workflow dimensions. */
        san.l.depth = d3.max(san.children.values(), function (n) {
            return n.col;
        }) + 1;
        san.l.width = d3.max(san.children.values(), function (n) {
            return n.row;
        }) + 1;

        /* Set grid. */
        san.children.values().forEach(function (n) {
            /* Set grid cell. */
            san.l.grid[n.col][n.row] = n;
        });
    };

    /**
     * Dagre layout for subanalysis.
     * @param san Subanalysis.
     * @param cell Width and height of a workflow node.
     */
    var dagreWorkflowLayout = function (san, cell) {

        /* Init graph. */
        var g = new dagre.graphlib.Graph();

        g.setGraph({rankdir: "LR", nodesep: 0, edgesep: 0, ranksep: 0, marginx: 0, marginy: 0});

        g.setDefaultEdgeLabel(function () {
            return {};
        });

        /* Add nodes. */
        san.children.values().forEach(function (n) {
            g.setNode(n.autoId, {label: n.autoId, width: cell.width, height: cell.height});
        });

        /* Add edges. */
        san.links.values().forEach(function (l) {
            g.setEdge(l.source.autoId, l.target.autoId, {
                minlen: 0,
                weight: 1,
                width: 0,
                height: 0,
                labelpos: "r",
                labeloffset: 10
            });
        });

        /* Compute layout. */
        dagre.layout(g);

        /* Init workflow node coords. */
        d3.entries(g._nodes).forEach(function (n) {
            san.children.get(n.key).x = parseInt(n.value.x-cell.width/2, 10);
            san.children.get(n.key).y = parseInt(n.value.y-cell.height/2, 10);
        });
    };

    /**
     * Dagre layout for analysis.
     * @param san Graph.
     */
    var dagreGraphLayout = function (graph, cell) {

        /* Init graph. */
        var g = new dagre.graphlib.Graph();
        g.setGraph({rankdir: "LR", nodesep: 0, edgesep: 0, ranksep: 0, marginx: 0, marginy: 0});
        g.setDefaultEdgeLabel(function () {
            return {};
        });

        /* Add nodes. */
        graph.aNodes.forEach(function (an) {
            g.setNode(an.autoId, {label: an.autoId, width: cell.width, height: cell.height});
        });

        /* Add edges. */
        graph.aLinks.forEach(function (l) {
            g.setEdge(l.source.parent.parent.autoId, l.target.parent.parent.autoId, {
                minlen: 1,
                weight: 1,
                width: 0,
                height: 0,
                labelpos: "r",
                labeloffset: 10
            });
        });

        /* Compute layout. */
        dagre.layout(g);

        var dlANodes = d3.entries(g._nodes);
        graph.aNodes.forEach(function (an) {
            an.x = parseInt(dlANodes.filter(function (d) {
                return d.key === an.autoId.toString();
            })[0].value.x-cell.width/2, 10);
            an.y = parseInt(dlANodes.filter(function (d) {
                return d.key === an.autoId.toString();
            })[0].value.y-cell.height/2, 10);
        });
    };

    /**
     * Main layout module function.
     * @param graph The main graph object of the provenance visualization.
     * @param cell Width and height of a workflow node.
     */
    var runLayoutPrivate = function (graph, cell) {

        /* Graph layout. */
        dagreGraphLayout(graph, cell);

        var bclgNodes = [];
        var startANodes = [];
        startANodes.push(graph.dataset);
        var tsANodes = topSortNodes(startANodes, graph.aNodes.length, graph);

        if (tsANodes !== null) {
            layerNodes(tsANodes, graph);

            startANodes = [];
            startANodes.push(graph.dataset);
            graph.aNodes.forEach(function (an) {
                an.l.ts.removed = false;
            });
            graph.aLinks.forEach(function (al) {
                al.l.ts.removed = false;
            });
            tsANodes = topSortNodes(startANodes, graph.aNodes.length, graph);
            layerNodes(tsANodes, graph);

            /* Analysis layout. */
            reorderSubanalysisNodes(groupNodes(tsANodes),cell);

            /* Workflow layout. */
            graph.saNodes.forEach(function (san) {
                dagreWorkflowLayout(san, cell);
            });
        } else {
            console.log("Error: Graph is not acyclic!");
        }
        return bclgNodes;
    };

    /**
     * Publish module function.
     */
    return {
        runLayout: function (graph, cell) {
            return runLayoutPrivate(graph, cell);
        }
    };
}();