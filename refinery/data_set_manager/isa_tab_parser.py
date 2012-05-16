'''
Created on May 11, 2012

@author: nils
'''

from collections import deque
from data_set_manager.models import Node, Attribute, Investigation, Study, \
    ProtocolReference, Protocol, ProtocolReferenceParameter, NodeCollection, \
    Ontology, Publication, Contact, Design, Factor
from sets import Set
import csv
import itertools
import logging
import simplejson

'''
from data_set_manager.isa_tab_parser import IsaTabParser
p = IsaTabParser()
p.run( "dfdf" )
p._parse_investigation_file( "/Users/nils/Data/Refinery/ISA-Tab/i_investigation.txt" )


p._parse_study_file( "/Users/nils/Data/Refinery/ISA-Tab/s_Expression Study in CDX2 knock-out mice.txt" )
p._parse_assay_file( "/Users/nils/Data/Refinery/ISA-Tab/a_transcriptomic.txt" )


p._parse_study_file( "/Users/nils/Data/Refinery/ISA-Tab/ae_hsci_imports/E-GEOD-16375/s_E-GEOD-16375_studysample.txt" )
p._parse_assay_file( "/Users/nils/Data/Refinery/ISA-Tab/ae_hsci_imports/E-GEOD-16375/a_E-GEOD-16375_assay.txt" )

p._parse_study_file( "/Users/nils/Data/Refinery/ISA-Tab/ae_hsci_imports/E-GEOD-16013/s_E-GEOD-16013_studysample.txt" )
p._parse_assay_file( "/Users/nils/Data/Refinery/ISA-Tab/ae_hsci_imports/E-GEOD-16013/a_E-GEOD-16013_assay.txt" )


'''


class IsaTabParser:
    
    SEPARATOR_CHARACTER = "\t"
    QUOTE_CHARACTER = "\""
    
    # investigation file sections    
    SECTIONS = {
        "ONTOLOGY SOURCE REFERENCE": 
        {
            "model": Ontology,
            "fields": 
            {
                "Term Source Name": "name",
                "Term Source File": "file_name",
                "Term Source Version": "version",
                "Term Source Description": "description"
            }
        },
        "INVESTIGATION": 
        {
            "model": Investigation,
            "fields":
            {
                "Investigation Identifier": "identifier",
                "Investigation Title": "title",
                "Investigation Description": "description",
                "Investigation Submission Date": "submission_date",
                "Investigation Public Release Date": "release_date"
            }
        },
        "INVESTIGATION PUBLICATIONS":
        {
            "model": Publication,
            "fields":
            {
                "Investigation PubMed ID": "pubmed_id",
                "Investigation Publication DOI": "doi",
                "Investigation Publication Author list": "authors",
                "Investigation Publication Title": "title",
                "Investigation Publication Status": "status",
                "Investigation Publication Status Term Accession Number": "status_accession",
                "Investigation Publication Status Term Source REF": "status_source"
            }
        },
        "INVESTIGATION CONTACTS":
        {
            "model": Contact,
            "fields":
            {
                "Investigation Person Last Name": "last_name",
                "Investigation Person First Name": "first_name",
                "Investigation Person Mid Initials": "middle_initials",
                "Investigation Person Email": "email",
                "Investigation Person Phone": "phone",
                "Investigation Person Fax": "fax",
                "Investigation Person Address": "address",
                "Investigation Person Affiliation": "affiliation",
                "Investigation Person Roles": "roles",
                "Investigation Person Roles Term Accession Number": "roles_accession",
                "Investigation Person Roles Term Source REF": "roles_source"
            }
        },
        "STUDY":
        {
            "model": Study,
            "fields":
            {
                "Study Identifier": "identifier",
                "Study Title": "title",
                "Study Submission Date": "submission_date",
                "Study Public Release Date": "release_date",
                "Study Description": "description",
                "Study File Name": "file_name",             
            }
        },
        "STUDY PUBLICATIONS":
        {
            "model": Publication,
            "fields":
            {
                "Study PubMed ID": "pubmed_id",
                "Study Publication DOI": "doi",
                "Study Publication Author list": "authors",
                "Study Publication Title": "title",
                "Study Publication Status": "status",
                "Study Publication Status Term Accession Number": "status_accession",
                "Study Publication Status Term Source REF": "status_source"
            }
        },
        "STUDY CONTACTS":
        {
            "model": Contact,
            "fields":
            {
                "Study Person Last Name": "last_name",
                "Study Person First Name": "first_name",
                "Study Person Mid Initials": "middle_initials",
                "Study Person Email": "email",
                "Study Person Phone": "phone",
                "Study Person Fax": "fax",
                "Study Person Address": "address",
                "Study Person Affiliation": "affiliation",
                "Study Person Roles": "roles",
                "Study Person Roles Term Accession Number": "roles_accession",
                "Study Person Roles Term Source REF": "roles_source"
            }
        },
        "STUDY DESIGN DESCRIPTORS":
        {
            "model": Design,
            "fields":
            {
                "Study Design Type": "type",
                "Study Design Type Term Accession Number": "type_accession",
                "Study Design Type Term Source REF": "type_source"
            }
        },
        "STUDY FACTORS":
        {
            "model": Factor,
            "fields":
            {
                "Study Factor Name": "name",
                "Study Factor Type": "type",
                "Study Factor Type Term Accession Number": "type_accession",
                "Study Factor Type Term Source REF": "type_source"             
            }
        },
        "STUDY ASSAYS":
        {
            "model": Study,
            "fields":
            {
                "Study Assay Measurement Type": "measurement",
                "Study Assay Measurement Type Term Accession Number": "measurement_accession",
                "Study Assay Measurement Type Term Source REF": "measurement_source",
                "Study Assay Technology Type": "technology",
                "Study Assay Technology Type Term Accession Number": "technology_type",
                "Study Assay Technology Type Term Source REF": "technology_source",
                "Study Assay Technology Platform": "platform",
                "Study Assay File Name": "file_name",             
            }
        },
        "STUDY PROTOCOLS":
        {
            "model": Study,
            "fields":
            {
                "Study Protocol Name": "name",
                "Study Protocol Type": "type",
                "Study Protocol Type Term Accession Number": "type_accession",
                "Study Protocol Type Term Source REF": "type_source",
                "Study Protocol Description": "description",
                "Study Protocol URI": "uri",
                "Study Protocol Version": "version",
                "Study Protocol Parameters Name": "name",
                # TODO: should this be "Study Protocol Parameters Name Accession Number"??? 
                "Study Protocol Parameters Name Term Accession Number": "name_accession",
                # TODO: should this be "Study Protocol Parameters Name Source REF"???
                "Study Protocol Parameters Name Term Source REF": "name_source",
                "Study Protocol Components Name": "name",
                "Study Protocol Components Type": "type",
                "Study Protocol Components Type Term Accession Number": "type_accession",
                "Study Protocol Components Type Term Source REF": "type_source",
            }
        }
    }
    
    _current_investigation = None
    _current_study = None
    _current_assay = None
    _current_node = None
    _previous_node = None
    _current_attribute = None
    _current_protocol_reference = None
    _current_reader = None
    _current_file = None
    _current_file_name = None
    
    _logger = None
    
    def __init__(self):
        self._logger = logging.getLogger(__name__)
        # create console handler with a higher log level
        self._logger.addHandler( logging.StreamHandler() )

    
    def _split_header(self, header):
        return [ x.strip() for x in header.replace( "]", "" ).strip().split( "[" ) ]        
    
    
    def _parse_node(self, headers, row ):
        '''
        row is a deque, column header is at position len( headers ) - len( row )
        ''' 

        # TODO: test if this is really a node

        header_components = self._split_header( headers[-len(row)] )
        
        # TODO: for a node the number of header components must be 1
        # assert( len( header_components ) ) == 1
        
        # try to retrieve this node from the database (unless it is a normalization or data transformation)
        is_new = True
        
        if ( header_components[0] in Node.ASSAYS | { Node.SAMPLE, Node.SOURCE, Node.EXTRACT, Node.LABELED_EXTRACT } ) or ( header_components[0] in Node.FILES and row[0].strip() is not "" ):
            node, is_new = Node.objects.get_or_create( study=self._current_study, assay=self._current_assay, type=header_components[0], name=row[0].strip() )
        else:
            node = Node.objects.create( study=self._current_study, assay=self._current_assay, type=header_components[0], name=row[0].strip() )
            
        
        if is_new:
            self._logger.info( "New node " + str( node ) + " created." )
        else:
            self._logger.info( "Node " + str( node ) + " retrieved." )
        
        self._current_node = node
        
        if self._previous_node is not None:
            try: 
                node.parents.get( to_node_id=self._previous_node.id )
            except:                
                self._previous_node.children.add( node )
                node.parents.add( self._previous_node )
                node.save()
                self._previous_node.save()        
                
        # remove the node from the row
        row.popleft()
        
        # read until we hit the next node
        while not self.is_node( headers[-len(row)] ):
            if self.is_attribute( headers[-len(row)] ):
                self._parse_attribute( headers, row )
            elif self.is_protocol_reference( headers[-len(row)] ):
                self._parse_protocol_reference( headers, row )
            else:                
                self._logger.error( "Unexpected element " + headers[-len(row)] +
                                        " when parsing node in line " + str( self._current_reader.line_num ) +
                                        ", column " + str( len(headers) - len(row) ) + "." )
                row.popleft()
                
        node.save()
        self._previous_node = node
        self._current_node = None
        return node
         
        
    def _parse_attribute(self, headers, row ):
        '''
        row is a deque, column header is at position len( headers ) - len( row )
        '''
        
        # TODO: test if this is really an attribute
         
        header_components = self._split_header( headers[-len(row)] )
        
        # TODO: for an attribute the number of header components must be 1 or 2 or 3 (for the "order" case, see ISA-Tab Spec 5.4.2)
        # assert( len( header_components ) ) > 0 and <= 3
        
        # TODO: do we need to test if this attribute type + subtype combination exists already for this study?
        
        attribute = Attribute.objects.create( node = self._current_node )
        attribute.study = self._current_study
        attribute.type = header_components[0]
        attribute.value = row[0]
        
        if len( header_components ) > 1:
            attribute.subtype = header_components[1]
        
        # TODO: deal with the "order" case (see ISA-Tab Spec 5.4.2)
         
        # remove the attribute from the row
        row.popleft()
        
        if self.is_term_information( headers[-len(row)] ):
            term_information = self._parse_term_information( headers, row )
            print term_information
            attribute.value_accession = term_information["accession"]
            attribute.value_source = term_information["source"]                        
        
        if self.is_unit( headers[-len(row)] ):
            unit_information = self._parse_unit_information( headers, row )
            attribute.value_unit = unit_information["unit"]
            attribute.value_accession = unit_information["accession"]
            attribute.value_source = unit_information["source"]
                                    
        # done        
        attribute.save()        
        return attribute

    
    def _parse_protocol_reference(self, headers, row ):
        
        if self.is_protocol_reference( headers[-len(row)] ):
                    
            # TODO: turn this into a get once protocols are parsed from the investigation file
            protocol, created = Protocol.objects.get_or_create( name=row[0], study=self._current_study )            
            if protocol is None:
                self._logger.exception( "Undeclared protocol " + row[0] +
                                       " when parsing term protocol in line " + str( self._current_reader.line_num ) +
                                       ", column " + str( len(headers) - len(row) ) + "." )
                                    
            protocol_reference = ProtocolReference.objects.create( node = self._current_node, protocol=protocol )
            self._current_protocol_reference = protocol_reference
                        
            row.popleft()
            
            while self.is_protocol_reference_information( headers[-len(row)] ):
                # TDOD: handle comments
                if self.is_protocol_reference_parameter( headers[-len(row)] ):
                    self._parse_protocol_reference_parameter(headers, row)
                elif self.is_protocol_reference_performer( headers[-len(row)] ):
                    protocol_reference.performer = row[0]
                    row.popleft()  
                    # TODO: lookup performer uuid from user database
                elif self.is_protocol_reference_date( headers[-len(row)] ):
                    protocol_reference.date = row[0]
                    row.popleft()  
                    # TODO: lookup performer uuid from user database
                else:
                    pass
                
            protocol_reference.save()            
            return protocol_reference
                                    
        
    def _parse_protocol_reference_parameter(self, headers, row ):
        header_components = self._split_header( headers[-len(row)] )
        
        # TODO: for a protocol reference parameter the number of header components must be 2 or 3 (for the "order" case, see ISA-Tab Spec 5.4.2)
        # assert( len( header_components ) ) > 1 and <= 3
        
        parameter = ProtocolReferenceParameter.objects.create( protocol_reference=self._current_protocol_reference )
        parameter.name = header_components[1]
        parameter.value = row[0]
        
        # TODO: deal with the "order" case (see ISA-Tab Spec 5.4.2)
         
        # remove the attribute from the row
        row.popleft()
        
        if self.is_term_information( headers[-len(row)] ):
            term_information = self._parse_term_information( headers, row )
            print term_information
            parameter.value_accession = term_information["accession"]
            parameter.value_source = term_information["source"]                        
        
        if self.is_unit( headers[-len(row)] ):
            unit_information = self._parse_unit_information( headers, row )
            parameter.value_unit = unit_information["unit"]
            parameter.value_accession = unit_information["accession"]
            parameter.value_source = unit_information["source"]
                                    
        # done        
        parameter.save()        
        return parameter


    def _parse_term_information(self, headers, row ):
        '''
        Parses a term_accession, term_source pair. Currently does not enforce any specific order.
        ''' 
                
        # parse the first component (if strict, this should be the accession number)
        if self.is_term_accession( headers[-len(row)] ):
            accession = row[0]
            row.popleft()
            
            # parse the second component (if strict, this should be the ontology reference)
            if self.is_term_source( headers[-len(row)] ):
                source = row[0]
                row.popleft()
                
                return { "accession": accession, "source": source }
                        
            else:
                self._logger.exception( "Unexpected element " + headers[-len(row)] +
                                       " when parsing term information in line " + str( self._current_reader.line_num ) +
                                       ", column " + str( len(headers) - len(row) ) + "." )
        
        elif self.is_term_source( headers[-len(row)] ):
            source = row[0]
            row.popleft()
            
            # parse the second component (if strict, this should be the ontology reference)
            if self.is_term_accession( headers[-len(row)] ):
                accession = row[0]
                row.popleft()
                
                return { "accession": accession, "source": source }
                        
            else:
                self._logger.exception( "Unexpected element " + headers[-len(row)] +
                                       " when parsing term information in line " + str( self._current_reader.line_num ) +
                                       ", column " + str( len(headers) - len(row) ) + "." )
        else:
            self._logger.exception( "Unexpected element " + headers[-len(row)] +
                                   " when parsing term information in line " + str( self._current_reader.line_num ) +
                                   ", column " + str( len(headers) - len(row) ) + "." )
        

    def _parse_unit_information(self, headers, row ):
        '''
        Parses a term_accession, term_source pair. Currently does not enforce any specific order.
        ''' 
                
        # parse the first component (if strict, this should be the accession number)
        if self.is_unit( headers[-len(row)] ):
            unit = row[0]
            row.popleft()
        else:
            self._logger.exception( "Unexpected element " + headers[-len(row)] +
                       " when parsing unit information in line " + str( self._current_reader.line_num ) +
                       ", column " + str( len(headers) - len(row) ) + "." )
            
        # parse term information if available
        if self.is_term_information( headers[-len(row)] ):
            term_information = self._parse_term_information(headers, row)
            
        return { "unit": unit, "accession": term_information["accession"], "source": term_information["source"] }                    


    def _parse_assay_file(self, study, assay, file_name):
        
        self._current_file_name = file_name
        self._current_assay = assay        
        self._parse_study_file(study, file_name)
                            
        
    def _parse_study_file(self, study, file_name):

        self._current_assay = None        
        self._current_file_name = file_name
        self._current_study = study        
        self._current_file =  open( file_name, "rb" )
        self._current_reader = csv.reader( self._current_file, dialect="excel-tab" )
                        
        # read column headers
        headers = []
        headers = self._current_reader.next()
        
        try:
            headers.remove( "" )
        except:
            pass
        
        # TODO: check if all factor values used in this file have been declared
        
        for row in self._current_reader:            
            row = deque( row )
            print( ", ".join( row ) )
            self._previous_node = None
            
            while len( row ) > 0:                
                self._current_node = None
                self._parse_node(headers, row)


    # parse an investigation section
    def _parse_investigation_file_section(self, section_title):
        
        try:
            section = self.SECTIONS[section_title]
            fields = {}
        except:
            return None
        
        while True:
            # 1. try to read the next line from the file
            try:
                start_position = self._current_file.tell()
                line = self._current_file.readline().decode( "utf-8", "replace" ).rstrip( "\n" )
                end_position = self._current_file.tell()
                                
                if end_position - start_position == 0:
                    # EOF reached
                    print( simplejson.dumps( fields, indent=3 ) )
                    return None                
            except:
                return None
            
            # 2. skip empty lines (ignoring all whitespace characters)
            if len( line.strip() ) == 0:
                continue

            # 3. split line on tab
            columns = line.split( "\t" )
            
            # 4. identify row type
            if columns[0].strip() in self.SECTIONS:
                # a section title was found, stop reading
                print( simplejson.dumps( fields, indent=3 ) )
                
                return columns[0].strip()
            elif columns[0].strip() in section["fields"]:
                # a section field was found, split row, trim white space and save in field dictionary
                field_name = columns[0].strip()
                # TODO: should we check for multiple instances of the same field? right now the last instance counts
                
                # test if last column is the start of a multiline field
                if not self.is_multiline_start(columns[-1]):                    
                    fields[field_name] = [column.strip().strip( "\"" ).replace( "\"\"\"", "\"" ) for column in columns[1:]]
                else:
                    fields[field_name] = [column.strip().strip( "\"" ).replace( "\"\"\"", "\"" ) for column in columns[1:-1]]                    

                    # deal with multi line field: read lines and split on tab until the first field is the end of a multiline field
                    while len( columns ) >= 1 and self.is_multiline_start(columns[-1]):                                                                        
                        multiline_field = columns[-1]
                        multiline_field_remainder, columns = self._parse_investigation_multiline_field()
                        multiline_field +=  multiline_field_remainder
                        
                        fields[field_name].append( multiline_field.strip().strip( "\"" ).replace( "\"\"\"", "\"" ) )
                        
                        # merge remaining columns from this line with previous columns (ignore last if is the start of a multiline field
                        if len( columns ) >= 1:
                            fields[field_name] = list( itertools.chain.from_iterable( [ fields[field_name], [column.strip().strip( "\"" ).replace( "\"\"\"", "\"" ) for column in columns[:-1] ] ] ) )
                            if not self.is_multiline_start(columns[-1]):
                                fields[field_name].append( columns[-1].strip().strip( "\"" ).replace( "\"\"\"", "\"" ) )
            else:
                # undefined field, ignore
                self._logger.warning( "Undefined field " + str( columns[0] ) + " found in column 1 when parsing \"" + section_title + "\" from " + self._current_file_name + "." )


    # returns lines 2-n of the multiline field (concatenated) and the remaining columns in line n  
    def _parse_investigation_multiline_field(self):
        multiline_field = ""
        
        while True: 
            try:
                start_position = self._current_file.tell()
                line = self._current_file.readline().decode( "utf-8", "replace" ).rstrip( "\n" )
                end_position = self._current_file.tell()
                                
                if end_position - start_position == 0:
                    # EOF reached
                    return None                
            except:
                self._logger.exception( "End of file reached in multiline field in " + self._current_file_name + "." )
                
            multiline_columns = line.split( "\t" )
            if not self.is_multiline_end( multiline_columns[0] ):
                multiline_field += "\n" + line
            else:
                multiline_field += "\n" + multiline_columns[0]
                return multiline_field, multiline_columns[1:] 
        
        
    
    def _parse_investigation_file(self, file_name):
        
        self._current_file_name = file_name
        self._current_file = open( file_name, "rb" )
        
        section_title = None
        
        # read lines from the file until a section title is found
        while True:
            # 1. try to read the next line from the file
            try:
                start_position = self._current_file.tell()
                line = self._current_file.readline().decode( "utf-8", "replace" ).rstrip( "\n" )
                end_position = self._current_file.tell()
                
                if end_position - start_position == 0:
                    # EOF reached
                    return None                
                                
            except:
                return None
            
            # 2. skip empty lines (ignoring all whitespace characters)
            if len( line.strip() ) == 0:
                continue

            # 3. split line on tab
            columns = line.split( "\t" )
            
            # 4. identify row type
            if columns[0].strip() in self.SECTIONS:
                # a section title was found, stop reading
                # TODO: can we push this line back? or peek?
                section_title = columns[0].strip()
                break 
            else:
                # undefined field, ignore
                self._logger.warning( "Field " + str( columns[0].strip() ) + " found in column 1 before section when parsing " + self._current_file_name + "." )
        
        # parse the sections
        while True:
            section_title = self._parse_investigation_file_section(section_title)
            
            if section_title is None:
                return
            
    
    def run(self, path):
        '''
        If path is a file it will be treated as an ISArchive, if it is a directory it will be treated
        as an extracted ISArchive
        '''
        
        # 1. test if archive needs to be extracted and extract if necessary
        
        # 2. identify investigation file
        
        # 3. parse investigation file and identify study files and corresponding assay files
        self._current_investigation = Investigation.objects.create()
        
        # 4. parse study file and corresponding assay files (repeat until no more study files)
        self._current_study = Study.objects.create( investigation=self._current_investigation )
        
        # TODO: parse this
    
    
    '''
    Utility Functions
    =================
    '''

    def is_multiline_start(self, string):        
        start_quote = False
        end_quote = False
        
        if string.startswith( "\"" ) and not string.startswith( "\"\"\"" ):
            start_quote = True            
        if string.endswith( "\"" ) and not string.endswith( "\"\"\"" ):
            end_quote = True
            
        # line that only contains a quote
        if len( string ) == 1 and ( start_quote or end_quote ):
            return True
        
        return start_quote and ( start_quote and not end_quote )


    def is_multiline_end(self, string):        
        start_quote = False
        end_quote = False
        
        if string.startswith( "\"" ) and not string.startswith( "\"\"\"" ):
            start_quote = True            
        if string.endswith( "\"" ) and not string.endswith( "\"\"\"" ):
            end_quote = True

        # line that only contains a quote
        if len( string ) == 1 and ( start_quote or end_quote ):
            return True
                
        return end_quote and ( end_quote and not start_quote )
            
    
    def is_node(self, string):
        return string.split( "[" )[0].strip() in Node.TYPES 

    
    def is_attribute(self, string):
        return string.split( "[" )[0].strip() in Attribute.TYPES

    
    def is_protocol_reference(self, string):
        return string.split( "[" )[0].strip() == "Protocol REF"

         
    def is_protocol_reference_parameter(self, string):
        return string.split( "[" )[0].strip() == "Parameter Value"


    def is_protocol_reference_performer(self, string):
        return string.split( "[" )[0].strip() == "Performer"


    def is_protocol_reference_date(self, string):
        return string.split( "[" )[0].strip() == "Date"


    def is_protocol_reference_information(self, string):
        return self.is_protocol_reference_date(string) or self.is_protocol_reference_performer(string) or self.is_protocol_reference_parameter(string) 


    def is_unit(self, string):
        return string.split( "[" )[0].strip() == "Unit"


    def is_term_accession(self, string):
        return string.split( "[" )[0].strip() == "Term Accession Number"


    def is_term_source(self, string):
        return string.split( "[" )[0].strip() == "Term Source REF"


    def is_term_information(self, string):
        return self.is_term_accession(string) or self.is_term_source(string)
    