// Detect if we are running in the extension subfolder
const isExtension = window.location.pathname.includes("/extension/");
const prefix = isExtension ? "../" : "";

var Hyphenopoly = {
  require: {
    "en-us": "FORCEHYPHENOPOLY",
  },
  setup: {
    selectors: {
      "#virtual-device p": {},
    },
  },
  paths: {
    patterndir: prefix + "js/patterns/",
    maindir: prefix + "js/",
  },
};
