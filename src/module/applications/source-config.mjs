/**
 * Application for configuring the source data on actors and items.
 */
export default class SourceConfig extends DocumentSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dnd5e", "source-config", "dialog"],
      template: "systems/anatrpg/templates/apps/source-config.hbs",
      width: 400,
      height: "auto",
      sheetConfig: false,
      keyPath: "system.details.source"
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `${game.i18n.localize("DND5E.SourceConfig")}: ${this.document.name}`;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options) {
    const context = super.getData(options);
    context.appId = this.id;
    context.CONFIG = CONFIG.ANAT;
    context.source = foundry.utils.getProperty(this.document, this.options.keyPath);
    context.sourceUuid = foundry.utils.getProperty(this.document, "flags.core.sourceId");
    context.hasSourceId = !!(await fromUuid(context.sourceUuid));
    return context;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const source = foundry.utils.expandObject(formData).source;
    return this.document.update({[this.options.keyPath]: source});
  }
}
