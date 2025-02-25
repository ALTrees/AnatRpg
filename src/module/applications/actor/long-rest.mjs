/**
 * A helper Dialog subclass for completing a long rest.
 *
 * @param {Actor5e} actor           Actor that is taking the long rest.
 * @param {object} [dialogData={}]  An object of dialog data which configures how the modal window is rendered.
 * @param {object} [options={}]     Dialog rendering options.
 */
export default class LongRestDialog extends Dialog {
  constructor(actor, dialogData={}, options={}) {
    super(dialogData, options);
    this.actor = actor;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/anatrpg/templates/apps/long-rest.hbs",
      classes: ["dnd5e", "dialog"]
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getData() {
    const data = super.getData();
    const variant = game.settings.get("dnd5e", "restVariant");
    data.promptNewDay = variant !== "gritty";     // It's always a new day when resting 1 week
    data.newDay = variant === "normal";           // It's probably a new day when resting normally (8 hours)
    return data;
  }

  /* -------------------------------------------- */

  /**
   * A helper constructor function which displays the Long Rest confirmation dialog and returns a Promise once it's
   * workflow has been resolved.
   * @param {object} [options={}]
   * @param {Actor5e} [options.actor]  Actor that is taking the long rest.
   * @returns {Promise}                Promise that resolves when the rest is completed or rejects when canceled.
   */
  static async longRestDialog({ actor } = {}) {
    return new Promise((resolve, reject) => {
      const dlg = new this(actor, {
        title: `${game.i18n.localize("DND5E.LongRest")}: ${actor.name}`,
        buttons: {
          rest: {
            icon: '<i class="fas fa-bed"></i>',
            label: game.i18n.localize("DND5E.Rest"),
            callback: html => {
              let newDay = true;
              if (game.settings.get("dnd5e", "restVariant") !== "gritty") {
                newDay = html.find('input[name="newDay"]')[0].checked;
              }
              resolve(newDay);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("Cancel"),
            callback: reject
          }
        },
        default: "rest",
        close: reject
      });
      dlg.render(true);
    });
  }
}
