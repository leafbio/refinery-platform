/**
 * Module for motif discovery and injection.
 */
var provvisMotifs = function () {

    var motifs = d3.map();

    /**
     * Breadth first search algorithm.
     * @param dsn Dataset node.
     */
    var bfs = function (dsn) {

        /**
         * Helper function to get successors of the current node;
         * @param n Node.
         */
        var getSuccs = function (n) {

            /* When node has only one input and output and successor node has no other inputs, start motif. */
            if (n.succs.size() === 1 && n.succs.values()[0].preds.size() === 1) {
                //console.log("#motif: "  + n.autoId);
            }

            /* Add successor nodes to queue. */
            n.succs.values().forEach(function (s) {
                if (s instanceof provvisDecl.Node && nset.indexOf(s.parent.parent) === -1) {
                    nset.push(s.parent.parent);
                    nqueue.push(s.parent.parent);
                } else if (nset.indexOf(s) === -1) {
                    nset.push(s);
                    nqueue.push(s);
                }
            });
        };

        var nqueue = [],
            nset = [];

        nset.push(dsn);
        nqueue.push(dsn);

        while (nqueue.length > 0) {
            getSuccs(nqueue.shift());
        }
    };


    /* TODO: In experimental development state. */

    /**
     * Find and mark sequential and parallel analysis steps.
     * @param graph The provenance graph.
     * @returns {*} Layered nodes.
     */
    var createLayerNodes = function (graph) {

        var layers = [],
            lNodes = d3.map(),
            layerId = 0;

        /* Iterate breath first search. */
        graph.bclgNodes.forEach(function (l, i) {

            /**
             * Helper function to compare two d3.map() objects.
             * @param a
             * @param b
             * @returns {boolean}
             */
            var compareMaps = function (a, b) {
                var equal = true;
                if (a.size() === b.size()) {
                    a.keys().forEach(function (k) {
                        if (!b.has(k)) {
                            equal = false;
                        }
                    });
                } else {
                    equal = false;
                }
                return equal;
            };

            /* For each depth-level. */
            l.forEach(function (an) {
                var foundMotif = false,
                    thisMotif = null,
                    anPreds = d3.map(),
                    anSuccs = d3.map();

                an.predLinks.values().forEach(function (pl) {
                    anPreds.set(pl.source.autoId, pl.source);
                });
                an.succLinks.values().forEach(function (sl) {
                    anSuccs.set(sl.target.autoId, sl.target);
                });

                /* Check if the current analysis conforms to a motif already created. */
                motifs.values().forEach(function (m) {
                    if (m.wfUuid === an.wfUuid && m.numSubanalyses === an.children.size() &&
                        an.predLinks.size() === m.numIns && an.succLinks.size() === m.numOuts) {

                        /* TODO: Revise tricky condition. */
                        if (an.preds.size() === 1 && an.preds.values()[0].uuid === "dataset" &&
                            compareMaps(anPreds, m.preds)) {
                            foundMotif = true;
                            thisMotif = m;
                        } else if (an.preds.size() === 1 && an.preds.values()[0].uuid !== "dataset") {
                            foundMotif = true;
                            thisMotif = m;
                        }
                    }
                });

                /* Create new motif. */
                if (!foundMotif) {
                    var motif = new provvisDecl.Motif();
                    an.predLinks.values().forEach(function (pl) {
                        motif.preds.set(pl.source.autoId, pl.source);
                    });
                    an.succLinks.values().forEach(function (sl) {
                        motif.succs.set(sl.target.autoId, sl.target);
                    });
                    motif.numIns = an.predLinks.size();
                    motif.numOuts = an.succLinks.size();
                    motif.wfUuid = an.wfUuid;
                    motif.numSubanalyses = an.children.size();
                    motifs.set(motif.autoId, motif);
                    an.motif = motif;
                } else {
                    an.motif = thisMotif;
                }
            });

            layers.push(d3.map());


            /* Group the same motifs into a layer. */
            l.forEach(function (an) {

                var keyStr = an.preds.values().map(function (pan) {
                        return pan.motif.autoId;
                    }),
                    layer = Object.create(null);

                if (!(layers[i].has(keyStr + "-" + an.motif.autoId))) {
                    layer = new provvisDecl.Layer(layerId, an.motif, graph, false);
                    layer.children.set(an.autoId, an);
                    an.layer = layer;
                    lNodes.set(layer.autoId, an.layer);
                    layerId++;

                    layers[i].set(keyStr + "-" + an.motif.autoId, layer.autoId);
                } else {
                    layer = lNodes.get(layers[i].get(keyStr + "-" + an.motif.autoId));
                    layer.children.set(an.autoId, an);
                    an.layer = layer;
                }

            });
        });
        return lNodes;
    };

    /**
     * For each layer the corresponding analyses, preceding and succeeding links as well as
     * specifically in- and output nodes are mapped to it.
     * @param graph The provenance graph.
     */
    var createLayerAnalysisMapping = function (graph) {

        /* Layer children are set already. */
        graph.lNodes.values().forEach(function (ln) {
            ln.children.values().forEach(function (an) {

                /* Set analysis parent. */
                an.parent = an.layer;

                /* Set input nodes. */
                an.inputs.values().forEach(function (n) {
                    ln.inputs.set(n.autoId, n);
                });
                /* Set output nodes. */
                an.outputs.values().forEach(function (n) {
                    ln.outputs.set(n.autoId, n);
                });
            });

            /* Set workflow name. */
            var wfName = "dataset";
            if (typeof graph.workflowData.get(ln.motif.wfUuid) !== "undefined") {
                wfName = graph.workflowData.get(ln.motif.wfUuid).name;
            }
            ln.wfName = wfName.toString();

            /* Set layer parent. */
            ln.parent = graph;
        });

        graph.lNodes.values().forEach(function (ln) {

            /* Set predecessor layers. */
            ln.children.values().forEach(function (an) {
                an.preds.values().forEach(function (pan) {
                    if (!ln.preds.has(pan.layer.autoId)) {
                        ln.preds.set(pan.layer.autoId, pan.layer);
                    }
                });
            });

            /* Set successor layers. */
            ln.children.values().forEach(function (an) {
                an.succs.values().forEach(function (san) {
                    if (!ln.succs.has(san.layer.autoId)) {
                        ln.succs.set(san.layer.autoId, san.layer);
                    }
                });
            });
        });

        /* Set layer links. */
        graph.lNodes.values().forEach(function (ln) {
            ln.children.values().forEach(function (an) {
                an.links.values().forEach(function (anl) {
                    ln.links.set(anl.autoId, anl);
                });
            });
        });

        /* Set predLinks and succLinks. */
        graph.lNodes.values().forEach(function (ln) {
            ln.inputs.values().forEach(function (lin) {
                lin.predLinks.values().forEach(function (l) {
                    ln.predLinks.set(l.autoId, l);
                });
            });
            ln.outputs.values().forEach(function (lon) {
                lon.succLinks.values().forEach(function (l) {
                    ln.succLinks.set(l.autoId, l);
                });
            });
        });

        /* Set layer links. */
        var linkId = 0;
        graph.lNodes.values().forEach(function (ln) {
            ln.succs.values().forEach(function (sl) {
                var layerLink = new provvisDecl.Link(linkId, ln, sl, false);
                graph.lLinks.set(layerLink.autoId, layerLink);
                linkId++;
            });
        });
    };

    /**
     * Dagre layout including layer nodes.
     * @param graph The provenance graph.
     * @param cell Node cell dimensions.
     */
    var dagreLayerLayout = function (graph, cell) {
        var g = new dagre.graphlib.Graph();

        g.setGraph({rankdir: "LR", nodesep: 0, edgesep: 0, ranksep: 0, marginx: 0, marginy: 0});

        g.setDefaultEdgeLabel(function () {
            return {};
        });

        var curWidth = 0,
            curHeight = 0;

        graph.lNodes.values().forEach(function (ln) {
            curWidth = cell.width;
            curHeight = ln.children.size() * cell.height;

            g.setNode(ln.autoId, {label: ln.autoId, width: curWidth, height: curHeight});
        });

        graph.lLinks.values().forEach(function (l) {
            g.setEdge(l.source.autoId, l.target.autoId, {
                minlen: 1,
                weight: 1,
                width: 0,
                height: 0,
                labelpos: "r",
                labeloffset: 0
            });
        });

        dagre.layout(g);

        var dlLNodes = d3.entries(g._nodes);
        graph.lNodes.values().forEach(function (ln) {
            curWidth = cell.width;
            curHeight = ln.children.size() * cell.height;

            ln.x = dlLNodes.filter(function (d) {
                return d.key === ln.autoId.toString();
            })[0].value.x - curWidth / 2;

            ln.y = dlLNodes.filter(function (d) {
                return d.key === ln.autoId.toString();
            })[0].value.y - curHeight / 2;

            ln.children.values().forEach(function (an, i) {
                an.x = 0;
                an.y = i * cell.height;
            });
        });
    };


    /**
     * Main motif discovery and injection module function.
     * @param graph The main graph object of the provenance visualization.
     * @param cell Node cell dimensions.
     */
    var runMotifsPrivate = function (graph, cell) {
        graph.lNodes = createLayerNodes(graph);
        createLayerAnalysisMapping(graph);
        dagreLayerLayout(graph, cell);

    };

    /**
     * Publish module function.
     */
    return {
        run: function (graph, cell) {
            return runMotifsPrivate(graph, cell);
        }
    };
}();