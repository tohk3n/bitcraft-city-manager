export const MAP_LINK = {
//gets values from checkboxes and input fields to pass into function and shows the generated link
  generateLinkEvent(){

    const checkboxes = Array
    .from(document.querySelectorAll('#checkbox-row input[type="checkbox"]:checked'))
    .map(cb => cb.value);

    let resourceIdInput = document.getElementById("res-ids")?.value || '';
    let playerIdInput = document.getElementById("player-ids")?.value || '';
    //removes possible comma at the end
    resourceIdInput = MAP_LINK.finalizeCommaNumberInput(resourceIdInput)
    playerIdInput = MAP_LINK.finalizeCommaNumberInput(playerIdInput)
    //use function to build the link
    const generatedLink = MAP_LINK.generateLink(checkboxes, resourceIdInput, playerIdInput)
    // show link in UI
    const linkEl = document.getElementById("map-link");
    linkEl.href = generatedLink;
    linkEl.textContent = generatedLink;
  },
  //generates link to bitcraft map from actual data
  generateLink(regions, resourceIds, playerIds){

    const dataMap = {};
    //fill map if values exist
    if(regions.length > 0){
      dataMap.regionId = regions.join(',');
    }
    if(resourceIds !== ''){
      dataMap.resourceId = encodeURIComponent(resourceIds);
    }
    if(playerIds !== ''){
      dataMap.playerId = (playerIds);
    }

    let generatedLink = CONFIG.MAP_BASE_URL;
    let first = true;

    //first value has ? as a prefix, following are connected by &
    for(const [key,value] of Object.entries(dataMap)){
      const prefix = first ? '?' : '&';
      generatedLink += `${prefix}${key}=${value}`;
      first = false;
    }
    return generatedLink;
  },

  addCommaNumberValidation(inputId) {
    const field = document.getElementById(inputId);
    if (!field) return;

    field.addEventListener('input', () => {
      let value = field.value;

      value = value
      .replace(/[^0-9,]/g, '')  // only numbers and commas
      .replace(/^,+/, '')       // no leading commas
      .replace(/\s*,\s*/g, ',') // no spaces around commas
      .replace(/,{2,}/g, ',');  // no duplicate commas

      field.value = value;
    });
  },
  finalizeCommaNumberInput(value) {
    return value.replace(/,+$/, '');     // no commas at the end
  }
};