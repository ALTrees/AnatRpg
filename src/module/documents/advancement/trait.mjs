import Advancement from "./advancement.mjs";
import SelectChoices from "../actor/select-choices.mjs";
import * as Trait from "../actor/trait.mjs";
import TraitConfig from "../../applications/advancement/trait-config.mjs";
import TraitFlow from "../../applications/advancement/trait-flow.mjs";
import {TraitConfigurationData, TraitValueData} from "../../data/advancement/trait.mjs";
import { filteredKeys } from "../../utils.mjs";

/**
 * Advancement that grants the player with certain traits or presents them with a list of traits from which
 * to choose.
 */
export default class TraitAdvancement extends Advancement {

  /** @inheritdoc */
  static get metadata() {
    return foundry.utils.mergeObject(super.metadata, {
      dataModels: {
        configuration: TraitConfigurationData,
        value: TraitValueData
      },
      order: 30,
      icon: "systems/anatrpg/icons/svg/trait.svg",
      title: game.i18n.localize("DND5E.AdvancementTraitTitle"),
      hint: game.i18n.localize("DND5E.AdvancementTraitHint"),
      apps: {
        config: TraitConfig,
        flow: TraitFlow
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * The maximum number of traits granted by this advancement. The number of traits actually granted may be lower if
   * actor already has some traits.
   * @type {number}
   */
  get maxTraits() {
    const { grants, choices } = this.configuration;
    return grants.size + choices.reduce((acc, choice) => acc + choice.count, 0);
  }

  /* -------------------------------------------- */
  /*  Preparation Methods                         */
  /* -------------------------------------------- */

  /**
   * Prepare data for the Advancement.
   */
  prepareData() {
    const rep = this.representedTraits();
    const traitConfig = rep.size === 1 ? CONFIG.ANAT.traits[rep.first()] : null;
    this.title = this.title || traitConfig?.labels.title || this.constructor.metadata.title;
    this.icon = this.icon || traitConfig?.icon || this.constructor.metadata.icon;
  }

  /* -------------------------------------------- */
  /*  Display Methods                             */
  /* -------------------------------------------- */

  /** @inheritdoc */
  configuredForLevel(level) {
    return !!this.value.chosen?.size;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  sortingValueForLevel(levels) {
    const traitOrder = Object.keys(CONFIG.ANAT.traits).findIndex(k => k === this.representedTraits().first());
    const modeOrder = Object.keys(CONFIG.ANAT.traitModes).findIndex(k => k === this.configuration.mode);
    const order = traitOrder + (modeOrder * 100);
    return `${this.constructor.metadata.order.paddedString(4)} ${order.paddedString(4)} ${this.titleForLevel(levels)}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  summaryForLevel(level, { configMode=false }={}) {
    if ( configMode ) {
      if ( this.configuration.hint ) return `<p>${this.configuration.hint}</p>`;
      return `<p>${Trait.localizedList({
        grants: this.configuration.grants, choices: this.configuration.choices
      })}</p>`;
    } else {
      return Array.from(this.value.chosen).map(k => `<span class="tag">${Trait.keyLabel(k)}</span>`).join(" ");
    }
  }

  /* -------------------------------------------- */
  /*  Application Methods                         */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async apply(level, data) {
    const updates = {};
    if ( !data.chosen ) return;

    for ( const key of data.chosen ) {
      const keyPath = Trait.changeKeyPath(key);
      let existingValue = updates[keyPath] ?? foundry.utils.getProperty(this.actor, keyPath);

      if ( ["Array", "Set"].includes(foundry.utils.getType(existingValue)) ) {
        existingValue = new Set(existingValue);
        existingValue.add(key.split(":").pop());
        updates[keyPath] = Array.from(existingValue);
      } else if ( (this.configuration.mode !== "expertise") || (existingValue !== 0) ) {
        updates[keyPath] = (this.configuration.mode === "default")
          || ((this.configuration.mode === "upgrade") && (existingValue === 0)) ? 1 : 2;
      }
    }

    this.actor.updateSource(updates);
    this.updateSource({ "value.chosen": Array.from(data.chosen) });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async restore(level, data) {
    this.apply(level, data);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async reverse(level) {
    const updates = {};
    if ( !this.value.chosen ) return;

    for ( const key of this.value.chosen ) {
      const keyPath = Trait.changeKeyPath(key);
      let existingValue = updates[keyPath] ?? foundry.utils.getProperty(this.actor, keyPath);

      if ( ["Array", "Set"].includes(foundry.utils.getType(existingValue)) ) {
        existingValue = new Set(existingValue);
        existingValue.delete(key.split(":").pop());
        updates[keyPath] = Array.from(existingValue);
      }

      else if ( this.configuration.mode === "expertise" ) updates[keyPath] = 1;
      else if ( this.configuration.mode === "upgrade" ) updates[keyPath] = existingValue === 1 ? 0 : 1;
      else updates[keyPath] = 0;
      // NOTE: When using forced expertise mode, this will not return to original value
      // if the value before being applied is 1.
    }

    const retainedData = foundry.utils.deepClone(this.value);
    this.actor.updateSource(updates);
    this.updateSource({ "value.chosen": [] });
    return retainedData;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Two sets of keys based on actor data, one that is considered "selected" and thus unavailable to be chosen
   * and another that is "available". This is based off configured advancement mode.
   * @returns {{selected: Set<string>, available: Set<string>}}
   */
  async actorSelected() {
    const selected = new Set();
    const available = new Set();

    // If "default" mode is selected, return all traits
    // If any other mode is selected, only return traits that support expertise
    const traitTypes = this.configuration.mode === "default" ? Object.keys(CONFIG.ANAT.traits)
      : filteredKeys(CONFIG.ANAT.traits, t => t.expertise);

    for ( const trait of traitTypes ) {
      const actorValues = await Trait.actorValues(this.actor, trait);
      const choices = await Trait.choices(trait, { prefixed: true });
      for ( const key of choices.asSet() ) {
        const value = actorValues[key] ?? 0;
        if ( this.configuration.mode === "default" ) {
          if ( value >= 1 ) selected.add(key);
          else available.add(key);
        } else {
          if ( value === 2 ) selected.add(key);
          if ( (this.configuration.mode === "expertise") && (value === 1) ) available.add(key);
          else if ( (this.configuration.mode !== "expertise") && (value < 2) ) available.add(key);
        }
      }
    }

    return { selected, available };
  }

  /* -------------------------------------------- */

  /**
   * Guess the trait type from the grants & choices on this advancement.
   * @param {Set<string>[]} [pools]  Trait pools to use when figuring out the type.
   * @returns {Set<string>}
   */
  representedTraits(pools) {
    const set = new Set();
    pools ??= [this.configuration.grants, ...this.configuration.choices.map(c => c.pool)];
    for ( const pool of pools ) {
      for ( const key of pool ) {
        const [type] = key.split(":");
        set.add(type);
      }
    }
    return set;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the list of available traits from which the player can choose.
   * @param {Set<string>} [chosen]  Traits already chosen on the advancement. If not set then it will
   *                                be retrieved from advancement's value.
   * @returns {{choices: SelectChoices, label: string}|null}
   */
  async availableChoices(chosen) {
    // TODO: Still shows "Choose 1 x" even if not possible due to mode restriction
    let { available, choices } = await this.unfulfilledChoices(chosen);

    // If all traits of this type are already assigned, then nothing new can be selected
    if ( foundry.utils.isEmpty(choices) ) return null;

    // Remove any grants that have no choices remaining
    let unfilteredLength = available.length;
    available = available.filter(a => a.choices.asSet().size > 0);

    // If replacements are allowed and there are grants with zero choices from their limited set,
    // display all remaining choices as an option
    if ( this.configuration.allowReplacements && (unfilteredLength > available.length) ) {
      const rep = this.representedTraits();
      return {
        choices: choices.filter(this.representedTraits().map(t => `${t}:*`), { inplace: false }),
        label: game.i18n.format("DND5E.AdvancementTraitChoicesRemaining", {
          count: unfilteredLength,
          type: Trait.traitLabel(rep.size === 1 ? rep.first() : null, unfilteredLength)
        })
      };
      // TODO: This works well for types without categories like skills where it is primarily intended,
      // but perhaps there could be some improvements elsewhere. For example, if I have an advancement
      // that grants proficiency in the Bagpipes and allows replacements, but the character already has
      // Bagpipe proficiency. In this example this just lets them choose from any other tool proficiency
      // as their replacement, but it might make sense to only show other musical instruments unless
      // they already have proficiency in all musical instruments. Might not be worth the effort.
    }

    if ( !available.length ) return null;

    // Create a choices object featuring a union of choices from all remaining grants
    const remainingSet = new Set(available.flatMap(a => Array.from(a.choices.asSet())));
    choices.filter(remainingSet);

    const rep = this.representedTraits(available.map(a => a.choices.asSet()));
    return {
      choices,
      label: game.i18n.format("DND5E.AdvancementTraitChoicesRemaining", {
        count: available.length,
        type: Trait.traitLabel(rep.size === 1 ? rep.first() : null, available.length)
      })
    };
  }

  /* -------------------------------------------- */

  /**
   * The advancement configuration is flattened into separate options for the user that are chosen step-by-step. Some
   * are automatically picked for them if they are 'grants' or if there is only one option after the character's
   * existing traits have been taken into account.
   * @typedef {object} TraitChoices
   * @property {"grant"|"choice"} type  Whether this trait is automatically granted or is chosen from some options.
   * @property {number} [choiceIdx]     An index that groups each separate choice into the groups that they originally
   *                                    came from.
   * @property {SelectChoices} choices  The available traits to pick from. Grants have only 0 or 1, depending on whether
   *                                    the character already has the granted trait.
   */

  /**
   * Determine which of the provided grants, if any, still needs to be fulfilled.
   * @param {Set<string>} [chosen]  Traits already chosen on the advancement. If not set then it will
   *                                be retrieved from advancement's value.
   * @returns {{ available: TraitChoices[], choices: SelectChoices }}
   */
  async unfulfilledChoices(chosen) {
    const actorData = await this.actorSelected();
    const selected = {
      actor: actorData.selected,
      item: chosen ?? this.value.selected ?? new Set()
    };

    // If everything has already been selected, no need to go further
    if ( this.maxTraits <= selected.item.size ) {
      return { available: [], choices: new SelectChoices() };
    }

    const available = await Promise.all([
      ...this.configuration.grants.map(async g => ({
        type: "grant",
        choices: await Trait.mixedChoices(new Set([g]))
      })),
      ...this.configuration.choices.reduce((arr, choice, index) => {
        return arr.concat(Array.fromRange(choice.count).map(async () => ({
          type: "choice",
          choiceIdx: index,
          choices: await Trait.mixedChoices(choice.pool)
        })));
      }, [])
    ]);

    available.sort((lhs, rhs) => lhs.choices.asSet().size - rhs.choices.asSet().size);

    // Remove any fulfilled grants
    for ( const key of selected.item ) available.findSplice(grant => grant.choices.asSet().has(key));

    // Merge all possible choices into a single SelectChoices
    const allChoices = await Trait.mixedChoices(actorData.available);
    allChoices.exclude(new Set([...(selected.actor ?? []), ...selected.item]));
    available.forEach(a => a.choices = allChoices.filter(a.choices, { inplace: false }));

    return { available, choices: allChoices };
  }
}
