/**
 * Module for motif discovery and injection.
 */
var provvisMotifs = function () {

    /**
     * Main motif discovery and injection module function.
     * @param graph The main graph object of the provenance visualization.
     */
    var runMotifsPrivate = function (graph) {
        console.log("#motif discovery:");
        console.log(graph);

    };

    /**
     * Publish module function.
     */
    return{
        runMotifs: function (graph) {
            runMotifsPrivate(graph);
        }
    };
}();