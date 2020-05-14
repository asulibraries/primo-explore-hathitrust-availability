angular.module("hathiTrustAvailability", [])
  .constant("hathiTrustBaseUrl", "https://catalog.hathitrust.org/api/volumes/brief/json/")
  .config(["$sceDelegateProvider", "hathiTrustBaseUrl", function($sceDelegateProvider, hathiTrustBaseUrl) {
    var urlWhitelist = $sceDelegateProvider.resourceUrlWhitelist();
    urlWhitelist.push(hathiTrustBaseUrl + "**");
    $sceDelegateProvider.resourceUrlWhitelist(urlWhitelist);
  }])
  .factory("hathiTrust", ["$http", "$q", "hathiTrustBaseUrl",
    function($http, $q, hathiTrustBaseUrl) {
      var svc = {};

      var lookup = function(ids) {
        if (ids.length) {
          var hathiTrustLookupUrl = hathiTrustBaseUrl + ids.join("|");
          return $http
            .jsonp(hathiTrustLookupUrl, {
              cache: true,
              jsonpCallbackParam: "callback"
            })
            .then(function(resp) {
              return resp.data;
            });
        } else {
          return $q.resolve(null);
        }
      };

      // find a HT record URL for a given list of identifiers (regardless of copyright status)
      svc.findRecord = function(ids) {
        return lookup(ids)
          .then(function(bibData) {
            if (bibData && bibData[ids[0]].items.length > 0) {
              var recordId = Object.keys(bibData[ids[0]].records)[0];
              return $q.resolve(bibData[ids[0]].records[recordId].recordURL);
            } else {
              return $q.resolve(null);
            }
          })
          .catch(function(e) {
            console.error(e);
          });
      };

      // find a public-domain HT record URL for a given list of identifiers
      svc.findFullViewRecord = function(ids) {
        var handleResponse = function(bibData) {
          var fullTextUrl = null;
          for (var i = 0; !fullTextUrl && i < ids.length; i++) {
            var result = bibData[ids[i]];
            for (var j = 0; j < result.items.length; j++) {
              var item = result.items[j];
              if (item.usRightsString.toLowerCase() === "full view") {
                fullTextUrl = result.records[item.fromRecord].recordURL;
                break;
              }
            }
          }
          return $q.resolve(fullTextUrl);
        };
        return lookup(ids)
          .then(handleResponse)
          .catch(function(e) {
            console.error(e);
          });
      };

      return svc;
    }
  ])
  .controller("hathiTrustAvailabilityController", [
    "hathiTrust",
    function(hathiTrust) {
      var self = this;

      self.$onInit = function() {
        setDefaults();

        // prevent appearance/request iff 'hide-online'
        if (isOnline() && self.hideOnline) { return; }

        // prevent appearance/request iff 'hide-if-journal'
        if (isJournal() && self.hideIfJournal){ return; }

        // look for full text at HathiTrust
        updateHathiTrustAvailability();
      };

      var setDefaults = function() {
        if (!self.msg) self.msg = "Full Text Available at HathiTrust";
      };

      var isJournal = function() {
        var format =  self.prmSearchResultAvailabilityLine.result.pnx.addata.format[0];
        return !(format.toLowerCase().indexOf("journal") == -1); // format.includes("Journal")
      };

      var isOnline = function() {
        return self.prmSearchResultAvailabilityLine.result.delivery.GetIt1.some(
          function(g) {
            return g.links.some(function(l) {
              return l.isLinktoOnline;
            });
          }
        );
      };

      var formatLink = function(link) {
        return self.entityId ? link + "?signon=swle:" + self.entityId : link;
      };

      var updateHathiTrustAvailability = function() {
        var hathiTrustIds = (self.prmSearchResultAvailabilityLine.result.pnx.addata.oclcid || []).map(function (id) {
          if (id.startsWith("(ocolc)")) {
            id = id.replace("(ocolc)", "");
            return "oclc:" + id;
          }
          else if (id.match(/^\d/)){
            return "oclc:" + id;
          }
        });
        hathiTrustIds = hathiTrustIds.filter(Boolean);
        hathiTrust[self.ignoreCopyright ? "findRecord" : "findFullViewRecord"](
          hathiTrustIds
        ).then(function(res) {
          if (res) self.fullTextLink = formatLink(res);
        });
      };
    }
  ])
  .component('hathiTrustAvailability', {
    require: {
      prmSearchResultAvailabilityLine: '^prmSearchResultAvailabilityLine'
    },
    bindings: {
      hideOnline: '<',
      msg: '@?'
    },
    controller: 'hathiTrustAvailabilityController',
    template: '<span ng-if="$ctrl.fullTextLink" class="umnHathiTrustLink">\
                <a target="_blank" ng-href="{{$ctrl.fullTextLink}}" \ class="browzine-web-link">\
                <img src="https://assets.thirdiron.com/images/integrations/browzine-open-book-icon.svg" class="browzine-book-icon"\ style="margin-left: 5px; margin-right: 3px; margin-bottom: -3px"\ aria-hidden="true" width="15" height="15" />\
                {{ ::$ctrl.msg }}\
                  <prm-icon external-link="" icon-type="svg" svg-icon-set="primo-ui" icon-definition="open-in-new"></prm-icon>\
                </a>\
              </span>'
  });
