// starting point of the application: snatching user informations. 
(function() {
  function sendCredentials() {
    if (typeof window.supermodelCSRF === 'string'
        && window.person
        && typeof window.person.username === 'string') {
      window.postMessage({
        source: 'LETTERBOXD_CREDENTIALS',
        username: window.person.username,
        csrfToken: window.supermodelCSRF
      }, window.location.origin);
    } else {
      // try again in 100ms
      setTimeout(sendCredentials, 100);
    }
  }
  sendCredentials();
})();
