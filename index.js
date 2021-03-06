/* eslint-env node */
'use strict';

const Plugin = require('ember-css-modules/lib/plugin');
const postcss = require('postcss');
const LintTests = require('./lib/lint-tests');
const formatter = require('./lib/formatter');

// this is a hack for using the right instance in engines
let engineReporterInstances = {};

module.exports = {
  name: 'ember-css-modules-reporter',

  createCssModulesPlugin(parent) {
    let reporterPlugin = new ReporterPlugin(parent, this.app);
    let isAddonInstance = !!parent.app;
    if (isAddonInstance) {
      engineReporterInstances[parent.options.name] = reporterPlugin;
    }
    return this.reporterPlugin = reporterPlugin;
  },

  lintTree(type, tree) {
    let plugin;
    if (tree.annotation === 'Funnel: Addon JS' && engineReporterInstances[tree.destDir]) {
      plugin = engineReporterInstances[tree.destDir];
    } else {
      plugin = this.reporterPlugin;
    }
    if (!plugin.generateTests) { return; }
    if ((plugin.isForApp() && type === 'app') || (plugin.isForAddon() && type === 'addon')) {
      return new LintTests({
        type: type,
        reporterPlugin: plugin,
        project: this.project
      });
    }
  }
};

class ReporterPlugin extends Plugin {
  constructor(parent, app) {
    super(parent);
    this.app = app;
    this.isEnabled = false;
    this.generateTests = true;
    this.logMessages = true;
    this.messages = new Map();
  }

  config(env, baseConfig) {
    this.isEnabled = this._shouldBeEnabled(env);
    if (!this.isEnabled) { return; }

    this.addPostcssPlugin(baseConfig, 'after', this._makeReporter());

    const reporterConfig = baseConfig.reporter;
    if (reporterConfig) {
      this.generateTests = reporterConfig.generateTests !== false;
      this.logMessages = reporterConfig.logMessages !== false;
    }
  }

  buildStart() {
    this.messages = new Map();
  }

  buildEnd() {
    const output = formatter(this.messages);
    if (output && this.logMessages) {
      this.parent.ui.writeLine(output);
    }
  }

  _makeReporter() {
    return postcss.plugin('ember-css-modules-reporter', () => (css, result) => {
      const input = css.source.input;
      const relativePath = input.file.replace(input.rootPath, '').substring(1);
      this.messages.set(relativePath, result.messages);
    });
  }

  _shouldBeEnabled() {
    if (this.isForApp()) {
      return !!this.app.hinting;
    } else {
      return this.parent.isDevelopingAddon() && this.parent.hintingEnabled();
    }
  }
}
