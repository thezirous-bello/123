import React, { memo } from "react";
import { Text, Pressable } from "react-native";

const FilterComponent = (props) => {
  const { filterDay, filterText, selectedRange, setSelectedRange } = props;

  const isFilterSelected = (filter) => filter === selectedRange;

  return (
    <Pressable
      onPress={() => setSelectedRange(filterDay)}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: isFilterSelected(filterDay)
          ? "#1e1e1e"
          : "transparent",
        flex: 1,
        alignItems: "center",
        marginHorizontal: 10,
        borderRadius: 5,
      }}
    >
      <Text
        style={{
          color: isFilterSelected(filterDay) ? "#FF07C9" : "#FF07C9",
          fontWeight: 700,
        }}
      >
        {filterText}
      </Text>
    </Pressable>
  );
};

export default memo(FilterComponent);
