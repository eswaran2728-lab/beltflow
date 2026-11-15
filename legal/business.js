/*
 * Business details shown on every legal page.
 *
 * FILL THESE IN, then set complete to true. While complete is false, every
 * legal page shows a "Draft" notice at the top, so an unfinished page is
 * never mistaken for the final one.
 *
 * Use the exact details from your SSM registration.
 */
window.BELTFLOW_BUSINESS = {
  complete: false,

  // Registered name of the business that operates BeltFlow.
  legalName: '',
  // SSM registration number.
  registrationNumber: '',
  // Registered or business address.
  address: '',
  // Contact e-mail for customers.
  email: '',
  // Contact telephone number.
  phone: '',
  // Who to contact about personal data (name or role, and e-mail).
  dataProtectionContact: '',
  // Country where the servers that hold the data are located.
  hostingLocation: '',
};

(function () {
  var b = window.BELTFLOW_BUSINESS;
  var missing = '[to be added]';
  document.addEventListener('DOMContentLoaded', function () {
    var nodes = document.querySelectorAll('[data-biz]');
    for (var i = 0; i < nodes.length; i++) {
      var value = b[nodes[i].getAttribute('data-biz')];
      nodes[i].textContent = value ? String(value) : missing;
      if (!value) nodes[i].className += ' biz-missing';
    }
    var banners = document.querySelectorAll('.draft-banner');
    for (var j = 0; j < banners.length; j++) banners[j].hidden = b.complete === true;
  });
})();
