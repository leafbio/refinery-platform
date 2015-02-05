/**
 * Module for motif discovery and injection.
 */
var provvisMotifs = function () {

    var motifs = d3.map();

    /**
     * Main motif discovery and injection module function.
     * @param graph The main graph object of the provenance visualization.
     * @param bclgNodes Barcentric layered and grouped nodes.
     */
    var runMotifsPrivate = function (graph, bclgNodes) {
        console.log("#motif discovery:");
        console.log(graph);

        console.log(bclgNodes);



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

                /* If n has at least one successor s, and all successors S have no other inputs, begin new motif. */

                /* The motif is extended by all successors S of n. */

                console.log(n);
                console.log(n.autoId);

                /* Rule A: n has a single successor s. s has no other predecessors. */
                if (n.succs.size() === 1) {

                    /* End of dummypath. */
                    if (n.succs.values()[0] instanceof provvisDecl.Node) {
                        nset.push(n.succs.values()[0].parent.parent);
                        nqueue.push(n.succs.values()[0].parent.parent);
                    } else {
                        nset.push(n.succs.values()[0]);
                        nqueue.push(n.succs.values()[0]);
                    }


                }
                /* Rule B: n has multiple successors S where every successor s is of the same workflow w.
                 * Rule E: n has multiple successors S conforming to heterogeneous workflows W.
                 */
                else if (n.succs.size() > 1) {
                    n.succs.values().forEach( function (s) {
                        if (nset.indexOf(s) === -1) {
                            nset.push(s);
                            nqueue.push(s);
                        }
                    });
                }

                /* Rule C: n has a single successor s, but all other predecessors of s
                 * conform to the same workflow w as n and they have a single successors s
                 * with the same workflow as s.
                 * Rule F:
                 * Rule H:
                 */

                /* Rule D:
                 * Rule G:
                 */
            };

            var nqueue = [],
                nset = [];
                nset.push(dsn);
                nqueue.push(dsn);
                while(nqueue.length > 0) {
                    getSuccs(nqueue.shift());
                }

            console.log(nset);
        };

        bfs(graph.dataset);
    };

    /**
     * Publish module function.
     */
    return{
        runMotifs: function (graph, bclgNodes) {
            runMotifsPrivate(graph, bclgNodes);
        }
    };
}();