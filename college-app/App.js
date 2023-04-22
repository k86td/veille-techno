import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { FlatList } from 'react-native';
import { ImageType } from 'expo-camera';

import { useEffect, useState } from 'react';

import { NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { Camera, CameraType } from 'expo-camera';

const StudentsTab = () => {
	return <View>
		<Text>
			Page d'acceuil pour le étudiants.
			Wow trop cool la vie!!
		</Text>
	</View>
}

const buttonStyles = StyleSheet.create({
	touchableButton: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		paddingHorizontal: 32,
		borderRadius: 4,
		elevation: 3,
		backgroundColor: 'black',
	},
	touchabeButtonText: {
		fontSize: 16,
		lineHeight: 21,
		fontWeight: 'bold',
		letterSpacing: 0.25,
		color: 'white',
	},
});

const CameraTab = () => {
	const [camera, setCamera] = useState(null);
	const [cameraType, setCameraType] = useState(CameraType.back);
	const [permission, requestPermission] = Camera.useCameraPermissions();
	const focused = useIsFocused();
	const [zoomLevel, setZoomLevel] = useState(0);

	// const [ratioSet, setRatioSet] = useState(false);
	// const [ratio, setRatio] = useState('4:3');

	if (!permission)
		return <View>
			<Text>No permissions. Whaa??</Text>
		</View>

	if (permission.canAskAgain)
		requestPermission();

	if (!permission.granted)
		return <View>
			<Text>Permission was denied :(</Text>
		</View>

	// // get the first supported ratio
	// if (!ratioSet && camera != null) {
	// 	camera.getSupportedRatiosAsync().then(ratio => { setRatio(ratio[0]); setRatioSet(true); })
	//
	// }

	const toggleCameraType = () => {
		if (cameraType == CameraType.back)
			setCameraType(CameraType.front);
		else
			setCameraType(CameraType.back);
	};

	const zoom = () => {
		switch (zoomLevel) {
			case 0:
				setZoomLevel(0.25);
				break;
			case 0.25:
				setZoomLevel(0.5);
				break;
			case 0.5:
				setZoomLevel(1);
				break;
			default:
				setZoomLevel(0);
				break;
		}
	};

	const capture = () => {
		console.debug("capturing");
		if (camera) {
			camera.takePictureAsync({
				imageType: ImageType.jpg,
				onPictureSaved: (pic) => {
					console.debug(pic.uri);
				}
			});
		}
	};


	return <View>
		{focused && <Camera
			style={{ width: "100%", height: "100%" }}
			ratio='4:3'
			type={cameraType}
			zoom={zoomLevel}
			ref={ref => {
				if (focused && camera == null && ref != null)
					setCamera(ref);
				else if (!focused)
					setCamera(null);
			}}
		>
			<View style={{ height: '100%', width: '100%', flex: 1, flexDirection: 'column-reverse' }}>
				<View style={{ flexDirection: 'row', justifyContent: 'space-between', margin: 10 }}>
					<TouchableOpacity style={[{ justifyContent: 'flex-end' }, buttonStyles.touchableButton]} onPress={toggleCameraType}>
						<Text style={[{ color: 'white' }, buttonStyles.touchabeButtonText]}>Flip</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[{ justifyContent: 'flex-end' }, buttonStyles.touchableButton]} onPress={capture}>
						<Text style={[{ color: 'white' }, buttonStyles.touchabeButtonText]}>Capturer</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[{ justifyContent: 'flex-end' }, buttonStyles.touchableButton]} onPress={zoom}>
						<Text style={[{ color: 'white' }, buttonStyles.touchabeButtonText]}>Zoom</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Camera>
		}
	</View >
}

const PlaybackFile = ({ file_name }) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [sound, setSound] = useState();

	const startPlaying = async () => {
		const sound = new Audio.Sound();
		await sound.loadAsync({ uri: file_name });

		sound.setOnPlaybackStatusUpdate(statusUpdate => {
			if (statusUpdate.isPlaying)
				setIsPlaying(true);
			else
				setIsPlaying(false);
		})

		setSound(sound);
		await sound.playAsync();

		setIsPlaying(true);
	};

	const stopPlaying = async () => {
		sound.unloadAsync();
		setIsPlaying(false);
	};

	useEffect(() => {
		return sound
			? () => {
				sound.unloadAsync();
				setIsPlaying(false);
			} : undefined;
	}, [sound]);

	return <View>
		<Text>Fichier: {file_name}</Text>
		<Button
			title={isPlaying ? "Arrêter" : "Jouer"}
			onPress={isPlaying ? stopPlaying : startPlaying}
		/>
	</View>
};

let key = 0;
function id() { return key++; }

const AudioTab = () => {
	const [isRecording, setIsRecording] = useState(false);
	const [recorded, setRecorded] = useState([]);
	const [buttonTitle, setButtonTitle] = useState("Enregistrer");
	const [recording, setRecording] = useState();


	const beginRecording = async () => {
		// try {
		await Audio.requestPermissionsAsync();
		await Audio.setAudioModeAsync({});

		const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
		setRecording(recording);
		setButtonTitle("Arrêter");
		setIsRecording(true);
		// }
		// catch (err) {
		// 	console.error("Couldn't start recording, " + err);
		// }
	};

	const stopRecording = async () => {
		try {
			setRecording(undefined);
			await recording.stopAndUnloadAsync();
			await Audio.setAudioModeAsync({});

			let uri = recording.getURI();
			setButtonTitle("Enregistrer");
			setIsRecording(false);
			console.debug(uri)


			setRecorded([...recorded, <PlaybackFile key={id()} file_name={uri} />]);
		}
		catch (err) {
			console.error("Error stopping the recording, " + err)
		}
	};

	return <View>
		<Button
			title={buttonTitle}
			onPress={isRecording ? stopRecording : beginRecording}
		/>
		{recorded}
	</View>
};

const tab = createBottomTabNavigator();

export default function App() {
	return (
		<NavigationContainer>
			<tab.Navigator
				screenOptions={({ route }) => ({
					tabBarIcon: ({ focused, color, size }) => {
						let iconName;

						if (route.name === 'Élèves') {
							iconName = focused
								? 'home'
								: 'home-outline';
						}
						else if (route.name === 'Caméra') {
							iconName = focused
								? 'camera'
								: 'camera-outline';
						}
						else if (route.name === 'Microphone') {
							iconName = focused
								? 'mic'
								: 'mic-outline';
						}

						// You can return any component that you like here!
						return <Ionicons name={iconName} size={size} color={color} />;
					},
					tabBarActiveTintColor: 'green',
					tabBarInactiveTintColor: 'gray',
				})}
			>

				<tab.Screen name="Microphone" component={AudioTab} />
				<tab.Screen name="Élèves" component={StudentsTab} />
				<tab.Screen name="Caméra" component={CameraTab} />
			</tab.Navigator>
		</NavigationContainer >
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
		alignItems: 'center',
		justifyContent: 'center',
	},
});
