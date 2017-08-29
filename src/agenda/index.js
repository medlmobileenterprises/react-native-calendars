import React, {Component} from 'react';
import {
  Text,
  View,
  Dimensions,
  Animated,
  ViewPropTypes,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform
} from 'react-native';
import PropTypes from 'prop-types';
import XDate from 'xdate';

import {parseDate, xdateToData, parseMonthInt} from '../interface';
import dateutils from '../dateutils';
import CalendarList from '../calendar-list';
import Calendar from '../calendar'
import ReservationsList from './reservation-list';
import styleConstructor from './style';
import { VelocityTracker } from '../input';
const { width, height } = Dimensions.get("window");

//const HEADER_HEIGHT = 104;
const HEADER_HEIGHT = 290;
const KNOB_HEIGHT = 24;
const calendarHeight = 290;
const statusBarHeight = Platform.os === 'ios'? 20: 28
const navigationBarHeight = Platform.os === 'ios'?44+statusBarHeight:56+statusBarHeight;

const reservationToggleHeight = 48;
const listHeight = height - calendarHeight - navigationBarHeight - reservationToggleHeight;

export default class AgendaView extends Component {
  static propTypes = {
    // Specify theme properties to override specific styles for calendar parts. Default = {}
    theme: PropTypes.object,

    // agenda container style
    style: ViewPropTypes.style,
    // the list of items that have to be displayed in agenda. If you want to render item as empty date
    // the value of date key has to be an empty array []. If there exists no value for date key it is
    // considered that the date in question is not yet loaded
    items: PropTypes.object,

    // callback that gets called when items for a certain month should be loaded (month became visible)
    loadItemsForMonth: PropTypes.func,
    // callback that gets called on day press
    onDayPress: PropTypes.func,
    // callback that gets called when day changes while scrolling agenda list
    onDaychange: PropTypes.func,
    // specify how each item should be rendered in agenda
    renderItem: PropTypes.func,
    // specify how each date should be rendered. day can be undefined if the item is not first in that day.
    renderDay: PropTypes.func,
    // specify how empty date content with no items should be rendered
    renderEmptyDay: PropTypes.func,
    // specify your item comparison function for increased performance
    rowHasChanged: PropTypes.func,

    // specify what should happen when the filter type has changed
    loopTypeChanged: PropTypes.func,

    // initially selected day
    selected: PropTypes.any,

    // Hide knob button. Default = false
    hideKnob: PropTypes.bool,
    // Month format in calendar title. Formatting values: http://arshaw.com/xdate/#Formatting
    monthFormat: PropTypes.string,

    // Raw data for use
    rawData: PropTypes.array,
    // Unavailabilities for calendar use
    unavailabilities: PropTypes.array,
    onRefreshCalendar: PropTypes.func,
    refreshingCalendar: PropTypes.bool

  };

  constructor(props) {
    super(props);
    this.styles = styleConstructor(props.theme);
    const windowSize = Dimensions.get('window');
    this.viewHeight = windowSize.height;
    this.viewWidth = windowSize.width;
    this.scrollTimeout = undefined;
    this.headerState = 'idle';

    this.state = {
      scrollY: new Animated.Value(0),
      calendarScrollable: true,
      firstResevationLoad: false,
      selectedDay: parseDate(this.props.selected) || XDate(true),
      topDay: parseDate(this.props.selected) || XDate(true),
      selectedTab:'available-loops',
      currentMonth : parseDate(this.props.selected) || XDate(true),
      markDates:{},

    };

    this.onLayout = this.onLayout.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onStartDrag = this.onStartDrag.bind(this);
    this.onSnapAfterDrag = this.onSnapAfterDrag.bind(this);
    this.knobTracker = new VelocityTracker();
    this.state.scrollY.addListener(({value}) => this.knobTracker.add(value));
  }

  calendarOffset() {
    return 90 - (this.viewHeight / 2);
  }

  initialScrollPadPosition() {
    return this.viewHeight - HEADER_HEIGHT;
  }

  setScrollPadPosition(y, animated) {
    // this.scrollPad._component.scrollTo({x: 0, y, animated});
  }

  onLayout(event) {
    this.viewHeight = event.nativeEvent.layout.height;
    this.viewWidth = event.nativeEvent.layout.width;
    // When user touches knob, the actual component that receives touch events is a ScrollView.
    // It needs to be scrolled to the bottom, so that when user moves finger downwards,
    // scroll position actually changes (it would stay at 0, when scrolled to the top).
    // this.setScrollPadPosition(this.initialScrollPadPosition(), false);
    // this.calendar.scrollToDay(this.state.selectedDay.clone(), this.calendarOffset(), false);
    this.forceUpdate();
  }

  onTouchStart() {
    this.headerState = 'touched';
    if (this.knob) {
      this.knob.setNativeProps({style: { opacity: 0.5 }});
    }
  }

  onTouchEnd() {
    if (this.knob) {
      this.knob.setNativeProps({style: { opacity: 1 }});
    }

    if (this.headerState === 'touched') {
      this.setScrollPadPosition(0, true);
      this.enableCalendarScrolling();
    }
    this.headerState = 'idle';
  }

  onStartDrag() {
    this.headerState = 'dragged';
    this.knobTracker.reset();
  }

  onSnapAfterDrag(e) {
    // on Android onTouchEnd is not called if dragging was started
    this.onTouchEnd();
    const currentY = e.nativeEvent.contentOffset.y;
    this.knobTracker.add(currentY);
    const projectedY = currentY + this.knobTracker.estimateSpeed() * 250/*ms*/;
    const maxY = this.initialScrollPadPosition();
    const snapY = (projectedY > maxY / 2) ? maxY : 0;
    this.setScrollPadPosition(snapY, true);
    if (snapY === 0) {
      this.enableCalendarScrolling();
    }
  }

  onVisibleMonthsChange(months) {
    if (this.props.items && !this.state.firstResevationLoad) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        if (this.props.loadItemsForMonth) {
          this.props.loadItemsForMonth(months[0]);
        }
      }, 200);
    }
  }

  loadReservations(props) {
    if ((!props.items || !Object.keys(props.items).length) && !this.state.firstResevationLoad) {
      this.setState({
        firstResevationLoad: true
      }, () => {
        if (this.props.loadItemsForMonth) {
          this.props.loadItemsForMonth(xdateToData(this.state.selectedDay));
        }
      });
    }
  }
  goBackToToday(){
    const day = XDate(true)
    this.chooseDay(day);
    this.onDayChange(day);
  }

  componentWillMount() {
    this.loadReservations(this.props);
  }

  componentWillReceiveProps(props) {
    if (props.items) {
      this.setState({
        firstResevationLoad: false
      },  this.updateMarkDates(props.items));
    } else {
      this.loadReservations(props);
    }
  }

  enableCalendarScrolling() {
    this.setState({
      calendarScrollable: true
    });
    // Enlarge calendarOffset here as a workaround on iOS to force repaint.
    // Otherwise the month after current one remains invisible.
    // Another working solution for this bug would be to set removeClippedSubviews={false}
    // in CalendarList listView, but that might impact performance too much.
    // Further info https://github.com/facebook/react-native/issues/1831
  }

  chooseDay=(d)=> {
    const day = parseDate(d);
    this.setState({
      selectedDay: day.clone(),
      currentMonth:day.clone()
    });
    if (this.state.calendarScrollable) {
      this.setState({
        topDay: day.clone()
      });
    }
    this.setScrollPadPosition(this.initialScrollPadPosition(), true);

    if (this.props.loadItemsForMonth) {
      this.props.loadItemsForMonth(xdateToData(day));
    }
    if (this.props.onDayPress) {
      this.props.onDayPress(xdateToData(day));
    }
    setTimeout(()=>{
      this.list.scrollOver = true;
    }, 500)

  }

  onPickedUpLoopsPressed() {
    if (this.state.selectedTab !== 'pickup-loops') {
      this.setState({
        selectedTab:'pickup-loops',
      }, this.updateMarkDates(this.props.items, ()=>this.props.loopTypeChanged(xdateToData(this.state.selectedDay))));
    }
  }

  onAvailableLoopsPressed() {
    if (this.state.selectedTab !== 'available-loops') {
      this.setState({
        selectedTab:'available-loops',
      }, this.updateMarkDates(this.props.items, ()=>this.props.loopTypeChanged(xdateToData(this.state.selectedDay))));
    }
  }

  updateMarkDates = (items, completionBlock) =>{
    var markDates = Object.assign({}, items);
    if(this.state.selectedTab === 'available-loops'){
      var availableMarkedDates = [];
      for(var propertyName in items) {
        let arrayEvents = markDates[propertyName];
        availableMarkedDates = arrayEvents.filter((book)=>{
          return book.available;
        })
        if(!availableMarkedDates.length){
          delete markDates[propertyName];
        }
      }
    }
    else if (this.state.selectedTab === 'pickup-loops') {
      var availableMarkedDates = [];
      for (var propertyName in items) {
        let arrayEvents = markDates[propertyName];
        availableMarkedDates = arrayEvents.filter((book) => {
          return !book.available;
        })
        if (!availableMarkedDates.length) {
          delete markDates[propertyName];
        }
      }
    }
    this.setState({
      markDates:markDates
    }, ()=>{
      if(completionBlock){
        completionBlock();
      }

    });
  }
  renderPickedUpLoopsText() {
    let textColor = '#9d9d9d';
    let underlineColor = 'transparent';
    if (this.state.selectedTab === 'pickup-loops') {
      textColor = '#343434';
      underlineColor = '#036e33';
    }
    return (
      <TouchableOpacity onPress={this.onPickedUpLoopsPressed.bind(this)} style={{flex: 1, alignItems: 'center'}}>
        <Text
          style={{textAlign: 'center', fontSize: 15, fontWeight: 'bold', color: textColor}}>
          Booked Loops
        </Text>
        <View style={{flex: 0, backgroundColor: underlineColor, height: 5, width: '70%', marginTop: 8}}/>
      </TouchableOpacity>
    );
  }

  renderAvailableLoopsText() {
    let textColor = '#9d9d9d';
    let underlineColor = 'transparent';
    if (this.state.selectedTab === 'available-loops') {
      textColor = '#343434';
      underlineColor = '#036e33';
    }
    return (
      <TouchableOpacity onPress={this.onAvailableLoopsPressed.bind(this)} style={{flex: 1, alignItems: 'center'}}>
        <Text
          style={{textAlign: 'center', fontSize: 15, fontWeight: 'bold', color: textColor}}>
          Available Loops
        </Text>
        <View style={{flex: 0, backgroundColor: underlineColor, height: 5, width: '65%', marginTop: 8}}/>
      </TouchableOpacity>
    );
  }

  renderReservations() {
    return (
      <ReservationsList
        rowHasChanged={this.props.rowHasChanged}
        renderItem={this.props.renderItem}
        renderDay={this.props.renderDay}
        renderEmptyDate={this.props.renderEmptyDate}
        reservations={this.props.items}
        selectedDay={this.state.selectedDay}
        topDay={this.state.topDay}
        onDayChange={this.onDayChange.bind(this)}
        onScroll={() => {}}
        ref={(c) => this.list = c}
        style={{height:listHeight}}
        tabSelected={this.state.selectedTab}
        theme={this.props.theme}
        unavailabitities={this.props.unavailabilities}
      />
    );
  }

  onDayChange(day) {
    const newDate = parseDate(day);
    const withAnimation = dateutils.sameMonth(newDate, this.state.selectedDay);

    // this.calendar.scrollToDay(day, this.calendarOffset(),  withAnimation);
    let currentMonth = parseMonthInt(this.state.selectedDay);
    let newMonth = parseMonthInt(day);
    let diff = newMonth - currentMonth
    if(diff !== 0){
      this.calendar.addMonth(diff);
    }


    this.setState({
      selectedDay: parseDate(day),
      currentMonth:parseDate(day)
    });

    if (this.props.onDayChange) {
      this.props.onDayChange(xdateToData(newDate));
    }
  }
  getCurrentDate() {
    return new Date();
  }
  render() {
    const agendaHeight = this.viewHeight - HEADER_HEIGHT - 12;

    const headerTranslate = this.state.scrollY.interpolate({
      inputRange: [0, agendaHeight],
      outputRange: [agendaHeight, 0],
      extrapolate: 'clamp',
    });

    const contentTranslate = this.state.scrollY.interpolate({
      inputRange: [0, agendaHeight],
      outputRange: [0, agendaHeight/2],
      extrapolate: 'clamp',
    });

    const headerStyle = [
      this.styles.header,
      { bottom: agendaHeight, transform: [{ translateY: headerTranslate }] },
    ];

    const shouldAllowDragging = !this.props.hideKnob && !this.state.calendarScrollable;
    const scrollPadPosition = (shouldAllowDragging ? HEADER_HEIGHT  : 0) - KNOB_HEIGHT;

    const scrollPadStyle = {
      position: 'absolute',
      width: 80,
      height: KNOB_HEIGHT,
      top: scrollPadPosition,
      left: (this.viewWidth - 80) / 2,
    };

    let knob = (<View style={this.styles.knobContainer}/>);

    if (!this.props.hideKnob) {
      knob = this.state.calendarScrollable ? null : (
        <View style={this.styles.knobContainer}>
          <View style={this.styles.knob} ref={(c) => this.knob = c}/>
        </View>
      );
    }


    if(Platform.OS === 'ios'){
      return this.renderCalendarIOS(headerStyle, contentTranslate);
    }
    else{
      return this.renderCalendarAndroid(headerStyle, contentTranslate);
    }
  }

  renderCalendarAndroid = (headerStyle, contentTranslate) =>{
    let shadowHeight = 10;
    return(
    <View style={this.props.style, {flex: 1}} onLayout={this.onLayout}>
      <Animated.View style={headerStyle}>
        <Animated.View style={{flex:1, transform: [{ translateY: contentTranslate }]}}>
          <ScrollView
              scrollEnabled={true}
              refreshControl={<RefreshControl refreshing={this.props.refreshingCalendar}
                                              onRefresh={this.props.onRefreshCalendar}/>}>
            <Calendar
                theme={this.props.theme}
                selected={[this.state.selectedDay]}
                ref={(c) => this.calendar = c}
                style={[{height: calendarHeight}, {
                  backgroundColor: '#ffffff',
                  shadowColor: '#DAD9E2',
                  shadowOffset: {
                    width: 0,
                    height: shadowHeight
                  },
                  shadowRadius: 5,
                  shadowOpacity: 1.0,
                  elevation: shadowHeight
                }]}
                hideArrows={false}
                hideExtraDays={this.props.hideExtraDays === undefined ? true : this.props.hideExtraDays}
                disableMonthChange={false}
                markedDates={this.state.markDates}
                current={this.state.currentMonth}
                markingType={this.props.markingType}
                onDayPress={this.chooseDay}
                displayLoadingIndicator={this.props.displayLoadingIndicator}
                minDate={this.getCurrentDate()}
                maxDate={this.props.maxDate}
                firstDay={this.props.firstDay}
                monthFormat={this.props.monthFormat}
                rawData={this.props.rawData}
                tabSelected={this.state.selectedTab}
                selected={XDate()}
                unavailabilities={this.props.unavailabilities}
            />
          </ScrollView>
        </Animated.View>
      </Animated.View>
      <View style={this.styles.reservations}>
        <View
            style={this.styles.reservationsToggle}
            loopTypeChanged={this.props.loopTypeChanged}
        >
          {this.renderAvailableLoopsText()}
          {this.renderPickedUpLoopsText()}
        </View>
        {this.renderReservations()}
      </View>
    </View>)
  }
  renderCalendarIOS(headerStyle, contentTranslate){
    let shadowHeight = 10;
    return(
    <ScrollView style={this.props.style, {flex: 1}} onLayout={this.onLayout}
                scrollEnabled={true}
                refreshControl={<RefreshControl refreshing={this.props.refreshingCalendar}
                                                onRefresh={this.props.onRefreshCalendar}/>}>
      <Animated.View style={headerStyle}>
        <Animated.View style={{flex:1, transform: [{ translateY: contentTranslate }]}}>
            <Calendar
                theme={this.props.theme}
                selected={[this.state.selectedDay]}
                ref={(c) => this.calendar = c}
                style={[{height: calendarHeight}, {
                  backgroundColor: '#ffffff',
                  shadowColor: '#DAD9E2',
                  shadowOffset: {
                    width: 0,
                    height: shadowHeight
                  },
                  shadowRadius: 5,
                  shadowOpacity: 1.0,
                  elevation: shadowHeight
                }]}
                hideArrows={false}
                hideExtraDays={this.props.hideExtraDays === undefined ? true : this.props.hideExtraDays}
                disableMonthChange={false}
                markedDates={this.state.markDates}
                current={this.state.currentMonth}
                markingType={this.props.markingType}
                onDayPress={this.chooseDay}
                displayLoadingIndicator={this.props.displayLoadingIndicator}
                minDate={this.getCurrentDate()}
                maxDate={this.props.maxDate}
                firstDay={this.props.firstDay}
                monthFormat={this.props.monthFormat}
                rawData={this.props.rawData}
                tabSelected={this.state.selectedTab}
                unavailabilities={this.props.unavailabilities}
            />
        </Animated.View>
      </Animated.View>
      <View style={this.styles.reservations}>
        <View
            style={this.styles.reservationsToggle}
            loopTypeChanged={this.props.loopTypeChanged}
        >
          {this.renderAvailableLoopsText()}
          {this.renderPickedUpLoopsText()}
        </View>
        {this.renderReservations()}
      </View>
    </ScrollView>);
  }
}
