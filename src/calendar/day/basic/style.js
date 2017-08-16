import {StyleSheet, Platform} from 'react-native';
import * as defaultStyle from '../../../style';

export default function styleConstructor(theme={}) {
  const appStyle = {...defaultStyle, ...theme};
  return StyleSheet.create({
    base: {
      width: 20,
      height: 20,
      alignItems: 'center'
    },
    text: {
      fontSize: appStyle.textDayFontSize,
      fontFamily: appStyle.textDayFontFamily,
      color: appStyle.dayTextColor,

      backgroundColor: 'rgba(255, 255, 255, 0)',
      marginTop: Platform.OS === 'android' ? 2 : 4
    },
    alignedText: {
      marginTop: Platform.OS === 'android' ? 2 : 4
    },
    selected: {
      backgroundColor: appStyle.selectedDayBackgroundColor,
      borderRadius: 10
    },
    todayText: {
      color: appStyle.todayTextColor
    },
    selectedText: {
      color: appStyle.selectedDayTextColor
    },
    disabledText: {
      color: appStyle.textDisabledColor
    },
    unavailableText: {
      fontSize: 15,
      color: appStyle.textUnavailableColor
    },
    eventText: {
      color: appStyle.textEventColor
    },
    dot: {
      width: 4,
      height: 4,
      marginTop: 0,
      borderRadius: 2,
      opacity: 0
    },
    visibleDot: {
      opacity: 1,
      backgroundColor: appStyle.dotColor
    },
    selectedDot: {
      backgroundColor: appStyle.selectedDotColor
    }
  });
}
