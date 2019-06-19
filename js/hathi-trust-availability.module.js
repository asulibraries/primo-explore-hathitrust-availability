angular.module('hathiTrustAvailability', [])
  .constant('hathiTrustBaseUrl', "https://catalog.hathitrust.org/api/volumes/brief/json/")
  .config(['$sceDelegateProvider', 'hathiTrustBaseUrl', function($sceDelegateProvider, hathiTrustBaseUrl) {
    var urlWhitelist = $sceDelegateProvider.resourceUrlWhitelist();
    urlWhitelist.push(hathiTrustBaseUrl + '**')
    $sceDelegateProvider.resourceUrlWhitelist(urlWhitelist);
  }])
  .factory('hathiTrust', ['$http', '$q', function ($http, $q) {
    var svc = {};
    var hathiTrustBaseUrl = "https://catalog.hathitrust.org/api/volumes/brief/json/";

    svc.findFullViewRecord = function (ids) {
      var deferred = $q.defer();

      var handleResponse = function(resp) {
        var data = resp.data;
        var fullTextUrl = null;
        for (var i = 0; !fullTextUrl && i < ids.length; i++) {
          var result = data[ids[i]];
          for (var j = 0; j < result.items.length; j++) {
            var item = result.items[j];
            if (item.usRightsString.toLowerCase() === "full view") {
              fullTextUrl = result.records[item.fromRecord].recordURL;
              break;
            }
          }
        }
        deferred.resolve(fullTextUrl);
      }

      if (ids.length) {
        console.log(ids);
        var hathiTrustLookupUrl = hathiTrustBaseUrl + ids.join('|');
        console.log(hathiTrustLookupUrl);
        $http.jsonp(hathiTrustLookupUrl, { cache: true , jsonpCallbackParam: 'callback'})
          .then(handleResponse)
          .catch(function(e) {console.log(e)});
      } else {
        deferred.resolve(null);
      }

      return deferred.promise;
    };

    return svc;

  }])
  .controller('hathiTrustAvailabilityController', ['hathiTrust', function (hathiTrust) {
    var self = this;

    self.$onInit = function() {
      setDefaults();
      if ( !(isOnline() && self.hideOnline) ) {
        updateHathiTrustAvailability();
      }
    }

    var setDefaults = function() {
      if (!self.msg) self.msg = 'View journal contents (HathiTrust coverage)';
    }

    var isOnline = function () {
      if (self.prmSearchResultAvailabilityLine.result.delivery.GetIt1) {
        return self.prmSearchResultAvailabilityLine.result.delivery.GetIt1.some(function (g) {
            return g.links.some(function (l) {
                return l.isLinktoOnline;
              });
          });
      } else {
        return false;
      }
    }

    var updateHathiTrustAvailability = function() {
      var hathiTrustIds = (self.prmSearchResultAvailabilityLine.result.pnx.addata.oclcid || []).map(function (id) {
        if (id.indexOf("(ocolc)", 0) !== -1) {
          id = id.replace("(ocolc)", "");
          return "oclc:" + id;
        } else {
          return id;
        }
      });
      hathiTrust.findFullViewRecord(hathiTrustIds).then(function (res) {
        self.fullTextLink = res;
      });
    }

  }])
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


//
