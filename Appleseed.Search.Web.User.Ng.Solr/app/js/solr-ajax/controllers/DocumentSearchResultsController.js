/**
 * This file is subject to the terms and conditions defined in the
 * 'LICENSE.txt' file, which is part of this source code package.
 */

'use strict';

/*---------------------------------------------------------------------------*/
/* DocumentSearchResultsController                                           */

/**
 * Presents search results for a named query.
 * @param $scope
 * @param $attrs
 * @param $location
 * @param $route
 * @param $routeParams
 * @param $window
 * @param SolrSearchService
 * @param Utils
 */
function DocumentSearchResultsController($scope, $rootScope, $attrs, $location, $route, $routeParams, $window, SolrSearchService, Utils) {

    // document search results
    $scope.documents = [];

    // the number of search results to display per page
    $scope.documentsPerPage = 20;

    $scope.siteDomainPath = $rootScope.siteDomainPath;
    // the current webpage's hostname/ what is sent to solr as a filter query 
    $scope.siteDomainHostname = $rootScope.siteDomainHostname;
    // what gets shown on the html before the relative path. 
    $scope.siteDomainAlias = $rootScope.siteDomainAlias;

    // flag for when the controller has submitted a query and is waiting on a
    // response
    $scope.loading = false;

    // set old count variable for doc counter
    $scope.oldTotalResults = 0;

    // the current search result page
    $scope.page = 0;

    // list of pages in the current navigation set plus prev and next
    $scope.pages = [];

    // list of pages in the current navigation set
    $scope.pagesOnly = [];

    // the number of pages in a navigation set
    $scope.pagesPerSet = 10;

    // flag for resetting location on page refresh
    $scope.resetLocation = true;

    // flag for if infinite scroll is enabled
    $scope.scrollInfinite = false;

    // flag for when the controller has submitted a load more query and is waiting on a
    // response
    $scope.scrollLoading = false;

    // amount of times that the infiniscroll has been called
    $scope.scrollPage = 1;

    // how much to increment the infiniscroll results
    $scope.scrollPageIncrement = 20;

    $scope.sortOption = "rel";

    // the query name
    $scope.queryName = SolrSearchService.defaultQueryName;

    // url to solr core
    $scope.source = undefined;

    // zero based document index for first record in the page
    $scope.start = 0;

    // count of the total number of result pages
    $scope.totalPages = 1;

    // count of the total number of search results
    $scope.totalResults = 0;

    // count of the number of search result sets
    $scope.totalSets = 1;

    // update the browser location on query change
    $scope.updateLocationOnChange = true;

    // user query
    $scope.userquery = '';

    // show addl locations
    $scope.isVisible = [];

    // measured search analytics key
    $scope.measuredSearchKey = '';

    ///////////////////////////////////////////////////////////////////////////

    /**
     * A page in a pagination list
     * @param Name Page name
     * @param Num Page number
     */
    function Page(Name,Num) {
        this.name = Name;
        this.number = Num;
        this.isCurrent = false;
    }

    // replace special characters with a space, then where there are two or more spaces, replace with a single space
    // also makes sure that if there is a space at the start or end of the string, it gets removed.
    function replaceSpecialChars(value) {
        return value.replace(/[\&\:\(\)\[\\\/]/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s/, '').replace(/\s$/, '').split(' ').join('*');
    };

    /**
     * Set the results page number.
     * @param Start Index of starting document
     */
    $scope.handleSetPage = function(Start) {
        var query = SolrSearchService.getQuery($scope.queryName);
        query.setOption('start', Start * $scope.documentsPerPage);
        
        if ($scope.updateLocationOnChange) {
            var hash = query.getHash();
            $location.path(hash);
            $window.scrollTo(0, 0);
        } else {
            $scope.loading = true;
            SolrSearchService.updateQuery($scope.queryName);
        }
    };

    /**
     * Retreive more results
     * @param Start Index of starting document
     */
    $scope.loadMoreResults = function(Start) {
        $scope.scrollInfinite = true;
        var query = SolrSearchService.getQuery($scope.queryName);
        query.setOption('start', 0);
        query.setOption('rows', $scope.scrollPage*$scope.scrollPageIncrement);
        
        if ($scope.updateLocationOnChange) {
            var hash = query.getHash();
            $location.path(hash);
            $scope.documentsPerPage += $scope.scrollPageIncrement;
            $scope.scrollPage++;
            //$window.scrollTo(0, 0);
        } else {
            $scope.loading = true;
            $scope.scrollLoading = true;
            SolrSearchService.updateQuery($scope.queryName);
        }
        
    };

    /**
     * Update the controller state.
     */
    $scope.handleUpdate = function() {
        // clear current results
        $scope.documents = [];
        $scope.loading = false;
        $scope.scrollLoading = false;
        // get new results
        var results = SolrSearchService.getResponse($scope.queryName);
        if (results && results.docs) {
            if (results.numFound !== $scope.totalResults) {
                $scope.oldTotalResults = $scope.totalResults;
            }

            // get query
            var query = SolrSearchService.getQuery($scope.queryName);

            $scope.totalResults = results.numFound;
            // calculate the total number of pages and sets
            $scope.totalPages = Math.ceil($scope.totalResults / $scope.documentsPerPage);
            $scope.totalSets = Math.ceil($scope.totalPages / $scope.pagesPerSet);

            // Measured Search: Search analytics function call
            //$scope.trackSearch();

            // add new results
            for (var i=0;i<results.docs.length && i<$scope.documentsPerPage;i++) {
                // clean up document fields
                results.docs[i].fromDate = Utils.formatDate(results.docs[i].fromDate);
                results.docs[i].toDate = Utils.formatDate(results.docs[i].toDate);

                // add to result list
                $scope.documents.push(results.docs[i]);
            }
        } else {
            $scope.documents = [];
            $scope.oldTotalResults = 0;
            $scope.totalResults = 0;
            $scope.totalPages = 1;
            $scope.totalSets = 1;

            $scope.loading = true;
            $scope.scrollLoading = true;
        }
        // update the page index
        $scope.updatePageIndex();
    };

    /// MEASURED SEARCH - ANALYTICS BEGIN ///
    $scope.trackSearch = function(){
        if(typeof _msq!=='undefined'){
            if($scope.userquery)
            _msq.push(['track', {
                key:        $scope.measuredSearchKey,
                query:      $scope.userquery,
                shownHits:  $scope.documentsPerPage,
                totalHits:  $scope.totalResults,
                pageNo:     $scope.scrollPage
            }]);
        }
    }

    $scope.trackSearchClick = function(docPosition, doc){
        if(typeof _msq!=='undefined'){
            _msq.push(['trackClick', { 
                key:        $scope.measuredSearchKey,
                query:      $scope.userquery,
                cDocId:     doc.physicianProfileURL,
                cDocTitle:  doc.physicianName[0],
                position:   docPosition+1, //may be zero if first one 
                pageNo:     $scope.scrollPage,
                pageUrl:    doc.physicianProfileURL,
                showHits:   $scope.documentsPerPage,
                totalHits:  $scope.totalResults
            }]);
        }
    }
    /// MEASURED SEARCH - ANALYTICS END ///

    /**
     * Initialize the controller.
     */
    $scope.init = function() {
        // apply configured attributes
        for (var key in $attrs) {
            if ($scope.hasOwnProperty(key)) {
                if (key == 'documentsPerPage' || key == 'pagesPerSet') {
                    $scope[key] = parseInt($attrs[key]);
                } else if ($attrs[key] == 'true' || $attrs[key] == 'false') {
                    $scope[key] = $attrs[key] == "true";
                } else {
                    $scope[key] = $attrs[key];
                }
            }
        }
        // handle location change event, update query results
        $scope.$on("$routeChangeSuccess", function() {
            // if there is a query in the current location
            $scope.query = ($routeParams.query || "");
            if ($scope.query) {
                // reset state
                $scope.loading = false;
                $scope.scrollLoading = false;
                // get the current query
                var query = SolrSearchService.getQueryFromHash($scope.query, $rootScope.appleseedsSearchSolrProxy);
                // if there is a data source specified, override the default
                if ($scope.source) {
                    query.solr = $scope.source;
                }
                // set $scope.sortOption based on query sort option.
                $scope.setSortOption(query);

                query.solr = $rootScope.appleseedsSearchSolrProxy;
                query.setOption("rows",$scope.documentsPerPage);
                // set the display values to match those in the query
                $scope.userquery = query.getUserQuery();
                // update query results
                SolrSearchService.setQuery($scope.queryName, query);
                $scope.loading = true;
                $scope.scrollLoading = true;
                SolrSearchService.updateQuery($scope.queryName);

                var hash = query.getHash();
                if (hash.includes("sort=score desc")) {
                    //console.log("use score sort");
                    //console.log(hash);
                    //DONE - if sort is defined, the default behavior will kick in which is a relevant search
                    //$scope.relevantSearch();
                } else {
                    //console.log("use glossary_sort");
                    //console.log(hash);
                    //DONE - if sort is not score, do alpha/glossary sort 
                    $scope.initialSearch('asc');
                }
                        
            }
            for (var item in $scope.isVisible) {
                $scope.isVisible[item] = false;
            }
        });
        // handle update events from the search service
        $scope.$on($scope.queryName, function () {
            $scope.handleUpdate();
        });
        
    };

    /**
     * Sets the alpha search to sort on last name and can be flipped ( asc/desc) . 
     * Alternatively also used to start the initial search. 
     */
    $scope.initialSearch = function(sortOrder) {
        // console.log("in initial alpha search");

         // clean up the user query
        var trimmed = Utils.trim($scope.userquery);
        if (trimmed === '') {
            $scope.userquery = "*:*";
        }
        // build the query string
        var query = SolrSearchService.getQuery($scope.queryName);
        var hash = $location.$$path.substring(1);
        if (hash && $scope.resetLocation) {
            query = SolrSearchService.getQueryFromHash(hash, $rootScope.appleseedsSearchSolrProxy);
        } else if (query == undefined) {
            query = SolrSearchService.createQuery($rootScope.appleseedsSearchSolrProxy);
        }

        // retrieve user query upon page load
        $scope.userquery = query.getUserQuery();
        query.setUserQuery($scope.userquery);

        query.solr = $rootScope.appleseedsSearchSolrProxy;
        
        if(sortOrder==='asc'|| sortOrder==='desc'){
            query.setOption("sort", "glossary_sort "+sortOrder);
        } else {
            //always start with alpha search in this initialSearch method
            query.setOption("sort", "glossary_sort asc");
        }

        query.setNearMatch($scope.nearMatch);
        query.setUserQuery($scope.userquery);
        
        SolrSearchService.setQuery($scope.queryName, query);
        SolrSearchService.updateQuery($scope.queryName);
        // the onRouteChange event handler will take care of the update

        // if created from sort event, then do the refresh thing
        if(sortOrder!='false'){
            // update the window location
            var hash = query.getHash();
            if ($scope.redirect) {
                $window.location.href = $scope.redirect + '#' + hash;
            } else {
                $location.path(hash);
            }
        }
        
    }

     /**
     * Sets the search sorting to score or relevance
     */
    $scope.relevantSearch = function() {
        // console.log("in relevant search");
         // clean up the user query
        var trimmed = Utils.trim($scope.userquery);
        if (trimmed === '') {
            $scope.userquery = "*:*";
        }
        // build the query string
        var query = SolrSearchService.getQuery($scope.queryName);
        if (query == undefined) {
            query = SolrSearchService.createQuery($rootScope.appleseedsSearchSolrProxy);
        }
        query.solr = $rootScope.appleseedsSearchSolrProxy;
        //query.setOption("sort", "score desc");
        query.setNearMatch($scope.nearMatch);
        query.setUserQuery($scope.userquery);

        SolrSearchService.setQuery($scope.queryName, query);
        SolrSearchService.updateQuery($scope.queryName);

        // update the window location
        var hash = query.getHash();
        if ($scope.redirect) {
            $window.location.href = $scope.redirect + '#' + hash;
        } else {
            $location.path(hash);
        }
    }

    /**
     * Depending on the selection runs the proper sortOption with methods
     */
    $scope.sortOptionChange = function(){
        switch ($scope.sortOption) {
            case "rel":
                $scope.relevantSearch();
                break;
            case "asc":
                $scope.initialSearch("asc");
                break;
            case "desc":
                $scope.initialSearch("desc");
            default:
                $scope.initialSearch("desc");
        }
    }

    /**
     * Update page index for navigation of search results. Pages are presented
     * to the user and are one-based, rather than zero-based as the start
     * value is.
     */
    $scope.updatePageIndex = function() {
        var query = SolrSearchService.getQuery($scope.queryName);
        $scope.documentsPerPage = (query.getOption('rows') || $scope.documentsPerPage);
        $scope.page = (Math.ceil(query.getOption('start') / $scope.documentsPerPage) || 0);
        // the default page navigation set 
        $scope.pages = [];
        // the default page navigation set - numbers only
        $scope.pagesOnly = [];
        // determine the current zero based page set
        var currentSet = Math.floor($scope.page / $scope.pagesPerSet);
        // determine the first and last page in the set
        var firstPageInSet = (currentSet * $scope.pagesPerSet) + 1;
        var lastPageInSet = firstPageInSet + $scope.pagesPerSet - 1;
        if (lastPageInSet > $scope.totalPages) {
            lastPageInSet = $scope.totalPages;
        }
        // link to previous set
        if ($scope.totalSets > 1 && currentSet != 0) {
            var previousSet = firstPageInSet - $scope.pagesPerSet - 1;
            var prevPage = new Page("«", previousSet);
            $scope.pages.push(prevPage);
        }
        // page links
        for (var i=firstPageInSet; i<=lastPageInSet; i++) {
            var page = new Page(i, i-1);
            if (page.number == $scope.page) {
                page.isCurrent = true;
            }
            $scope.pages.push(page);
            $scope.pagesOnly.push(page);
        }
        // link to next set
        if ($scope.totalSets>1 && currentSet<$scope.totalSets-1) {
            var nextSet = lastPageInSet;
            var nextPage = new Page("»", nextSet);
            $scope.pages.push(nextPage);
        }
    };

    $scope.setSortOption = function (query) {
        if (query.getOption("sort") == "glossary_sort asc") {
            $scope.sortOption = "asc";
        } else if (query.getOption("sort") == "glossary_sort desc") {
            $scope.sortOption = "desc";
        } else {
            $scope.sortOption = "rel";
        }
    };

    $scope.showMoreLocations = function(item) {
        //If DIV is visible it will be hidden and vice versa.
        $scope.isVisible[item] = !$scope.isVisible[item];
    };

    // initialize the controller
    $scope.init();

}

// inject controller dependencies
DocumentSearchResultsController.$inject = ['$scope', '$rootScope', '$attrs', '$location', '$route', '$routeParams', '$window', 'SolrSearchService', 'Utils'];
