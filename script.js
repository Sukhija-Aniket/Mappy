'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteButton = document.querySelector('.btn-danger');
const sortButton = document.querySelector('.btn-primary');
const viewButton = document.querySelector('.btn-secondary');

// let map, mapEvent;

class Workout {
  clicks = 0;
  date = new Date();
  id = (Date.now() + '').slice(-10);
  constructor(coords, distance, duration) {
    this.coords = coords; // [lat,lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August','September', 'October', 'November', 'December'
    ];

    this.description = `${this.type} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.pace = this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevation = elevationGain;
    this.speed = this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const run1 = new Running();

////////////////////////////////////
// Application Architecture

class App {
  #mapZoom = 13;
  #map;
  #mapEvent;
  #workouts = [];
  #markers = [];
  sorted = false;

  constructor() {
    this._getPosition();
    this._getLocalStorage(this.sorted);
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField.bind(this));
    containerWorkouts.addEventListener('click', this._moveOrRemove.bind(this));
    deleteButton.addEventListener('click', this._reset);
    sortButton.addEventListener('click', this._sort.bind(this));
    viewButton.addEventListener('click', this._viewAllMarker.bind(this));
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _newWorkout(e) {
    e.preventDefault();

    // helper functions
    const validate = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // get data from the form.
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    const coords = [lat, lng];
    let workout;

    // check if the data is valid for running and create the object.
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !validate(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('input fields must all be positive numbers');
      workout = new Running(coords, distance, duration, cadence);
    }

    // check if the data is valid for running and create the object.
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validate(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('input fields must all be positive numbers');
      workout = new Cycling(coords, distance, duration, elevation);
    }

    // Add new object to the working array.
    this.#workouts.push(workout);

    // Render workout on map as marker.
    this._renderWorkoutMarker(workout);

    // Render workout on List
    this._renderWorkout(workout);

    // hide form and clear input fields.
    this._hideForm();

    // set local storage to all workouts
    this._setLocalStorage();
  }

  _setLocalStorage() {
    const workoutsUnSorted = this.#workouts;
    workoutsUnSorted.sort((a, b) => a.date - b.date);
    localStorage.setItem('workouts', JSON.stringify(workoutsUnSorted));
    const workoutsSorted = this.#workouts;
    workoutsSorted.sort((a, b) => a.distance - b.distance);
    localStorage.setItem('workoutsSorted', JSON.stringify(workoutsSorted));
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputElevation.value =
      inputCadence.value =
        '';

    form.classList.add('hidden');
  }

  _renderWorkoutMarker(workout) {
    console.log(workout.description);
    let marker = new L.marker(workout.coords);
    this.#markers.push(marker);
    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          minWidth: 100,
          maxWidth: 250,
          className: `${workout.type}-popup`,
          autoClose: false,
          closeOnClick: false,
        }).setContent(workout.description)
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let htmlTemplate = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    
          <h2 class="workout__title">${workout.type} on April 14
          <span class="close_button">&times;</span>
          </h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃' : '🚴'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === 'running') {
      htmlTemplate += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace?.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;
    }

    if (workout.type === 'cycling') {
      htmlTemplate += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed?.toFixed(1)}</span>
            <span class="workout__unit">km/hr</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.elevation}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;
    }

    form.style.display = 'none';
    form.insertAdjacentHTML('afterend', htmlTemplate);
    setTimeout(() => {
      form.style.display = 'grid';
    }, 1000);
  }

  _getPosition() {
    const _this = this;
    navigator.geolocation.getCurrentPosition(
      function (position) {
        // console.log(position.coords);
        const { latitude, longitude } = position.coords;
        const coords = [latitude, longitude];
        _this.#map = L.map('map').setView(coords, _this.#mapZoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(_this.#map);

        _this.#workouts.forEach(workout => {
          _this._renderWorkoutMarker(workout);
        });
        _this.#map.on('click', _this._showForm.bind(_this));

        return;
      },
      function () {
        alert('Map could not be accessed');
      }
    );
  }

  _moveOrRemove(e) {
    if (!e.target.classList.contains('close_button')) this._moveToPopup(e);
    else this._removeMarker(e);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    console.log();
    this.#map.setView(workout.coords, this.#mapZoom, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // workout.click();
  }

  _getLocalStorage(sorted) {
    this.#workouts = [];
    let data;
    if (this.sorted === false) {
      data = JSON.parse(localStorage.getItem('workoutsSorted'));
      if (!data) return;
      this.sorted = true;
    } else {
      data = JSON.parse(localStorage.getItem('workouts'));
      if (!data) return;
      this.sorted = false;
    }
    console.log(this.sorted);
    // the click function won't work after storing data in form of string so recreate all the objects.
    // this.#workouts = data;
    // data.forEach(workout => this._renderWorkout(workout));
    const listElements = containerWorkouts.getElementsByTagName('li');

    while (listElements.length > 0) {
      containerWorkouts.removeChild(listElements[0]);
    }
    data.forEach(workoutString => {
      let workout;
      if (workoutString.type == 'running') {
        workout = new Running(
          workoutString.coords,
          workoutString.distance,
          workoutString.duration,
          workoutString.cadence
        );
      }
      if (workoutString.type == 'cycling') {
        workout = new Cycling(
          workoutString.coords,
          workoutString.distance,
          workoutString.duration,
          workoutString.elevation
        );
      }
      workout.clicks = workoutString.clicks;
      workout.date = workoutString.date;
      workout.id = workoutString.id;
      workout.description = workoutString.description;
      this.#workouts.push(workout);
      this._renderWorkout(workout);
    });
  }

  _reset() {
    localStorage.removeItem('workouts');
    localStorage.removeItem('workoutsSorted');
    location.reload();
  }

  _sort() {
    // containerWorkouts.removeElements('li');
    this._getLocalStorage(this.sorted);
    // location.reload();
  }

  _removeMarker(e) {
    const workoutEl = e.target.closest('.workout');
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#workouts = this.#workouts.filter(
      work => work.id !== workoutEl.dataset.id
    );
    this.#markers.forEach(marker => {
      if (
        marker._latlng.lat == workout.coords[0] &&
        marker._latlng.lng == workout.coords[1]
      ) {
        this.#map.removeLayer(marker);
      }
    });
    this._setLocalStorage();
    workoutEl.remove();
  }

  _viewAllMarker() {
    let group = new L.featureGroup([...this.#markers]);
    this.#map.fitBounds(group.getBounds());
    console.log(group.getBounds());
  }
}

const app = new App();

// extra functions
