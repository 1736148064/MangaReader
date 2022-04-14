import React, { useEffect } from 'react';
import { action, useAppSelector, useAppDispatch } from '~redux';
import { Box, Flex, Image, Text, ScrollView } from 'native-base';
import { TouchableOpacity } from 'react-native';

const { loadManga, loadChapter } = action;

const Detail = ({ route, navigation }: StackDetailProps) => {
  const id = route.params.id;
  const dispatch = useAppDispatch();
  const mangaDict = useAppSelector((state) => state.dict.manga);
  const mangaToChapter = useAppSelector((state) => state.dict.mangaToChapter);

  const data = mangaDict[id] || undefined;
  const chapterList = mangaToChapter[id] || [];
  const canUse = !!data;

  useEffect(() => {
    dispatch(loadManga(id));
  }, [dispatch, id]);

  useEffect(() => {
    canUse && navigation.setOptions({ title: data.title });
  }, [canUse, navigation, data]);

  const handleChapter = (mangaId: string, chapterId: string) => {
    return () => {
      dispatch(loadChapter({ mangaId, chapterId }));
    };
  };

  if (!canUse) {
    return null;
  }

  return (
    <ScrollView>
      <Flex w="100%" bg="#6200ee" flexDirection="row" pl="4" pr="4" pb="5">
        <Image
          w="130"
          h="160"
          flexGrow="0"
          flexShrink="0"
          source={{ uri: data.cover }}
          resizeMode="cover"
          borderRadius="md"
          alt="cover"
        />
        <Flex flexGrow="1" flexShrink="1" pl="4">
          <Text color="white" fontSize="20" fontWeight="bold" numberOfLines={2}>
            {data.title}
          </Text>
          <Text color="white" fontSize="14" fontWeight="bold" numberOfLines={1}>
            {data.author}
          </Text>
          <Box flexGrow="1" />
          <Text color="white" fontSize="14" fontWeight="bold" numberOfLines={1}>
            {data.updateTime}
          </Text>
        </Flex>
      </Flex>
      <Flex flexWrap="wrap" flexDirection="row" p={2}>
        {chapterList.map((item) => {
          const isActived = false;
          return (
            <Box w="1/4" p={2} key={item.chapterId}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleChapter(item.mangaId, item.chapterId)}
              >
                <Text
                  bg={isActived ? '#6200ee' : 'transparent'}
                  color={isActived ? 'white' : '#717171'}
                  borderColor="#717171"
                  overflow="hidden"
                  borderRadius="md"
                  borderWidth={isActived ? 0 : 0.5}
                  textAlign="center"
                  numberOfLines={1}
                  fontWeight="bold"
                  p={[1, 0]}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            </Box>
          );
        })}
      </Flex>
    </ScrollView>
  );
};

export default Detail;