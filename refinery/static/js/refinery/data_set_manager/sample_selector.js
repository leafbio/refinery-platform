/*
 * sample_selector.js
 *  
 * Author: Nils Gehlenborg 
 * Created: 30 January 2012
 *
 * An interface to select samples (nodes) using Solr and to push the selection to tools and viewers. 
 */


/*
 * Dependencies:
 * - JQuery
 * - underscore.js
 * - backbone.js
 * - solr_utilities.js
 * - solr_client.js
 * - solr_query.js
 * - solr_response.js
 */


// check for existence of namespace: http://addyosmani.github.com/backbone-fundamentals/#namespacing
var sample_selector =  sample_selector || {};

// check for existence of nested children
sample_selector.view = sample_selector.view || {};
sample_selector.router = sample_selector.router || {};
sample_selector.model = sample_selector.model || {};
sample_selector.model.special = sample_selector.model.special || {};

// routers
//sampleSelector.router.Workspace   = Backbone.Router.extend({});
//sampleSelector.router.TodoSearch = Backbone.Router.extend({});

// models
sample_selector.model.FacetValue = Backbone.RelationalModel.extend({
	defaults: {
		name: "",
		count: 0,
		isSelected: false,
	},	

	toggle: function() {
		this.save({
			isSelected: !this.get('isSelected')
		});
	}	
});


sample_selector.view.FacetValueView = Backbone.View.extend({
	tagName: 'li',
	
	template: _.template( $( "#sample-selector-facet-value-view-template" ).html() ),
	
	initalize: function() {
	},
	
	render: function() {
		console.log( this.model );
		
		this.$el.html( this.template( this.model.toJSON() ));
		
		return this;
	},
});



sample_selector.model.Facet = Backbone.RelationalModel.extend({
	defaults: {
		name: "",
	},	

    relations: [{
        type: Backbone.HasMany,
        key: 'values',
        relatedModel: 'sample_selector.model.FacetValue',
    }],
    
    count: function() {
    	return this.get( 'values' ).length;
    },	
});



sample_selector.view.FacetView = Backbone.View.extend({
	tagName: 'div',
	
	headerTemplate: _.template( $( "#sample-selector-facet-view-template" ).html() ),
	
	initalize: function() {
        _.bindAll(this, 'render', 'renderFacetValue');
        this.model.bind('change', this.render);
        this.model.bind('reset', this.render);
        this.model.bind('add:values', this.renderFacetValue); 
	},
	
	render: function() {
		console.log( this.model );
		
		this.$el.html( this.headerTemplate({
			name: this.model.get( 'name' ),
			count: this.model.get( 'values' ).length
		}) );
		
		for (var i=0; i < this.model.get( 'values').length; i++) {
			console.log( this.model.get( 'values' ).at(i) );
			this.renderFacetValue(this.model.get('values').at(i) );
		};

		
		return this;
	},
	
	renderFacetValue: function(facetValue) {
		var facetValueView = new sample_selector.view.FacetValueView({model: facetValue});
		this.$( "ul.facet-value-list" ).append( facetValueView.render().el );
	}	
});


sample_selector.model.FacetList = Backbone.Collection.extend({	
	model: sample_selector.model.Facet,	
});


sample_selector.view.FacetListView = Backbone.View.extend({
	el: "#sample-selector-facets",
	
	initalize: function() {		
		window.sample_selector.Facets.on( 'add', this.addOne, this );
		window.sample_selector.Facets.on( 'reset', this.addAll, this );
		window.sample_selector.Facets.on( 'all', this.render, this );
						
		window.sample_selector.Facets.fetch();
	},
	
	render: function() {
		return this;
	},
	
	addOne: function( facet ) {
		var view = new sample_selector.view.FacetView({ model: facet });
		this.$('#sample-selector-facet-list').append( view.render().el );
	},

	addAll: function() {
		this.$('#sample-selector-facet-list').html('');
		sample_selector.Facets.each(this.addOne, this);
	}

});



var fv1 = new sample_selector.model.FacetValue({ name: "fv1", count: 1, isSelected: false  });
var fv2 = new sample_selector.model.FacetValue({ name: "fv2", count: 2, isSelected: false  });
var fv3 = new sample_selector.model.FacetValue({ name: "fv3", count: 3, isSelected: false  });
var fv4 = new sample_selector.model.FacetValue({ name: "fv4", count: 4, isSelected: true  });
var fv5 = new sample_selector.model.FacetValue({ name: "fv5", count: 5, isSelected: false  });

var f1 = new sample_selector.model.Facet( {name: "F1", values: [ fv1, fv2 ] });
var f2 = new sample_selector.model.Facet( {name: "F2", values: [ fv2 ] });
var f3 = new sample_selector.model.Facet( {name: "F2", values: [ fv3, fv4, fv5] });
var f4 = new sample_selector.model.Facet( {name: "F2", values: [ fv1, fv2, fv3, fv4, fv5] });

sample_selector.Facets = new sample_selector.model.FacetList();
sample_selector.Facets.add([f1,f2,f3,f4]);

var flv = new sample_selector.view.FacetListView();
/*
flv.addOne( f1 );
flv.addOne( f2 );
flv.addOne( f3 );
flv.addOne( f4 );
*/

