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
sample_selector.layout = sample_selector.layout || {};

sample_selector.router = sample_selector.router || {};
sample_selector.model = sample_selector.model || {};
sample_selector.collection = sample_selector.collection || {};
//sample_selector.model.special = sample_selector.model.special || {};

// routers
//sampleSelector.router.Workspace   = Backbone.Router.extend({});
//sampleSelector.router.TodoSearch = Backbone.Router.extend({});

//===================================================================
// models
//===================================================================

sample_selector.model.FacetValue = Backbone.RelationalModel.extend({
	defaults: {
		name: "",
		count: 0,
		isSelected: false,
	},	

	toggleSelection: function() {
		//this.save({
			this.set( "isSelected", !this.get('isSelected') );
		//});
	}	
});


sample_selector.model.Facet = Backbone.RelationalModel.extend({
	defaults: {
		name: "",
		isExpanded: false,
	},	

    relations: [{
        type: Backbone.HasMany,
        key: 'values',
        relatedModel: 'sample_selector.model.FacetValue',
    }],

	toggle: function() {
		//this.save({
			this.set( "isExpanded", !this.get('isExpanded') );
		//});
	},		
	    
    totalCount: function() {
    	return this.get( 'values' ).length;
    },	

    selectedCount: function() {
    	return _.filter( this.get('values').models, function( facetValue ){ return facetValue.get( 'isSelected' ) == true } ).length;
    },
});


sample_selector.model.Field = Backbone.RelationalModel.extend({
	defaults: {
		name: "",
		isSelected: true,
		isVisible: true,
		sortDirection: "",
	},
	
	toggleSelection: function() {
		this.set( "isSelected", !this.get('isSelected') );		
	},

	toggleVisibility: function() {
		this.set( "isVisible", !this.get('isVisible') );		
	},
});


sample_selector.model.FieldList = Backbone.RelationalModel.extend({
    relations: [{
        type: Backbone.HasMany,
        key: 'fields',
        relatedModel: 'sample_selector.model.Field',
    }],	
});


sample_selector.model.Document = Backbone.RelationalModel.extend({
	defaults: {
		fields: {},
		isSelected: true,
	},
	
	toggleSelection: function() {
		this.set( "isSelected", !this.get('isSelected') );		
	}
});


//===================================================================
// collections
//===================================================================

sample_selector.collection.FacetCollection = Backbone.Collection.extend({	
	model: sample_selector.model.Facet,	
});

sample_selector.collection.DocumentCollection = Backbone.Collection.extend({	
	model: sample_selector.model.Document,	
});

sample_selector.collection.FieldCollection = Backbone.Collection.extend({	
	model: sample_selector.model.Field,	
});


//===================================================================
// views
//===================================================================

sample_selector.view.FacetValueView = Backbone.View.extend({
	tagName: 'li',
	
	template: _.template( $( "#sample-selector-facet-value-view-template" ).html() ),
	
	events: {
		"click": "clicked",
	},
	
	initialize: function() {
		_.bindAll(this, 'render');
		this.model.bind('change', this.render);
	},
	
	clicked: function(event) {
		event.preventDefault();
		this.model.toggleSelection();
	},
	
	render: function() {
		this.$el.html( this.template( this.model.toJSON() ));
	},
});


sample_selector.view.FacetView = Backbone.View.extend({
	tagName: 'div',
	
	template: _.template( $( "#sample-selector-facet-view-template" ).html() ),

	events: {
		"click .facet-header": "clicked",
	},
		
	initialize: function() {
        _.bindAll(this, 'renderFacetValue', 'render');
        this.model.bind('change', this.render);
        
        for ( var i = 0; i < this.model.totalCount(); ++i ) {
        	var child = this.model.get( "values").at( i );
        	
        	this.listenTo( child, 'change', this.render );
        }
	},
	
	clicked: function(event) {
		event.preventDefault();
		this.model.toggle();
	},
		
	render: function() {
		this.$el.html( this.template({
			name: this.model.get( 'name' ),
			totalCount: this.model.totalCount(),
			selectedCount: this.model.selectedCount()			
		}) );		
		
		if ( this.model.get( 'isExpanded' ) ) {
			this.model.get('values').each( this.renderFacetValue );			
		}
	},
	
	renderFacetValue: function(facetValue) {
		var facetValueView = new sample_selector.view.FacetValueView({model: facetValue});
		facetValueView.render();
		this.$el.append( facetValueView.el );
	}	
});


sample_selector.view.FacetCollectionView = Backbone.View.extend({
	//tagName: 'div',
	
	initialize: function() {
		_.bindAll( this, 'renderFacet' );
	},
	
	render: function() {
		this.collection.each( this.renderFacet );
	},
	
	renderFacet: function( facet ) {
		var facetView = new sample_selector.view.FacetView({model: facet});
		facetView.render();
		this.$el.append( facetView.el );		
	},
});


sample_selector.view.DocumentTableView = Backbone.Marionette.ItemView.extend({
	tagName: 'tr',
	template: "#sample-selector-document-item-template",

	events: {
		"click .selection": "clickedSelection",
	},
	
	clickedSelection: function(event) {
		event.preventDefault();		
		this.model.toggleSelection();
		this.render();
	},    

});


sample_selector.view.FieldTableView = Backbone.Marionette.ItemView.extend({
	tagName: 'td',
	template: "#sample-selector-field-item-template",

	events: {
		"click .selection": "clickedSelection",
	},
	
	clickedSelection: function(event) {
		event.preventDefault();		
		this.model.toggleSelection();
				alert( "clicked header " + this.model.get( "name" ) );

		this.render();
	},    	
});


sample_selector.view.FieldCollectionTableView = Backbone.Marionette.CompositeView.extend({
	tagName: 'thead',
	template: "#sample-selector-field-collection-template",
    itemView: sample_selector.view.FieldTableView,

	events: {
		"click .selection": "clickedSelection",
	},
	
	clickedSelection: function(event) {
		event.preventDefault();		
		this.model.toggleSelection();
		alert( "clicked header " + this.model.get( "name" ) );
		this.render();
	},    
	
	/*
    appendHtml: function( collectionView, itemView ) {
        collectionView.$("thead").append(itemView.el);
    }
    */
});


sample_selector.view.DocumentCollectionTableView = Backbone.Marionette.CollectionView.extend({
    tagName: 'tbody',
    template: "#sample-selector-document-collection-template",
    itemView: sample_selector.view.DocumentTableView,
    
	events: {
		"click .selection": "clickedSelection",		
		"click .header": "clickedHeader",
	},

	clickedSelection: function(event) {
		event.preventDefault();
		console.log( 'table clicked');		
	},    

	clickedHeader: function(event) {
		event.preventDefault();		
		//this.model.toggleSelection();
		//this.render();
		alert( "clicked header " + this.model.get( "fields" ) );
	},    

	/*
    appendHtml: function( collectionView, itemView ) {
        collectionView.$("tbody").append(itemView.el);
    } 
    */   
});
  

var fv1 = new sample_selector.model.FacetValue({ name: "fv1", count: 1, isSelected: false  });
var fv2 = new sample_selector.model.FacetValue({ name: "fv2", count: 2, isSelected: false  });
var fv3 = new sample_selector.model.FacetValue({ name: "fv3", count: 3, isSelected: false  });
var fv4 = new sample_selector.model.FacetValue({ name: "fv4", count: 4, isSelected: true  });
var fv5 = new sample_selector.model.FacetValue({ name: "fv5", count: 5, isSelected: false  });

var f1 = new sample_selector.model.Facet( {name: "F1", values: [ fv1, fv2 ] });
var f2 = new sample_selector.model.Facet( {name: "F2", values: [ fv2 ] });
var f3 = new sample_selector.model.Facet( {name: "F3", values: [ fv3, fv4, fv5] });
var f4 = new sample_selector.model.Facet( {name: "F4", values: [ fv1, fv2, fv3, fv4, fv5] });

var facets = new sample_selector.collection.FacetCollection([f1,f2,f3,f4]);
var fcv = new sample_selector.view.FacetCollectionView({collection: facets, el: "#sample-selector-facets"});
fcv.render();

var fl1 = new sample_selector.model.Field({name: "name"});
var fl2 = new sample_selector.model.Field({name: "lastname"});
var fl3 = new sample_selector.model.Field({name: "language"});

//var fields = new sample_selector.model.FieldList({fields:[fl1, fl2]})
//var flv1 = new sample_selector.view.FieldListTableHeaderView({model: fields});
//flv1.render();

var fieldCollection = new sample_selector.collection.FieldCollection([fl1,fl2]);
var fcv1 = new sample_selector.view.FieldCollectionTableView({ collection: fieldCollection });
fcv1.render();

var d1 = new sample_selector.model.Document({ fields: { "name": "firstname 1", "lastname": "lastname 1", "language": "C++" }});
var d2 = new sample_selector.model.Document({ fields: { "name": "firstname 2", "lastname": "lastname 2" }});

var documents = new sample_selector.collection.DocumentCollection([d1,d2]);
var dcv1 = new sample_selector.view.DocumentCollectionTableView({collection: documents});
dcv1.render();

$("#sample-selector-documents" ).append( fcv1.el );
$("#sample-selector-documents" ).append( dcv1.el );






