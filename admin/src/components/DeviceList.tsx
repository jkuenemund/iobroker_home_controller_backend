import React, { Component } from "react";
import { withStyles } from "@material-ui/core/styles";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    CircularProgress
} from "@material-ui/core";
import { Visibility as VisibilityIcon } from "@material-ui/icons";

const styles = () => ({
    table: {
        minWidth: 650,
    },
    jsonPre: {
        backgroundColor: "#f5f5f5",
        padding: "10px",
        overflow: "auto",
        maxHeight: "400px",
    },
});

interface DeviceListProps {
    classes: Record<string, string>;
    socket: any;
    basePath: string;
}

interface DeviceListState {
    devices: any[];
    loading: boolean;
    selectedDevice: any | null;
    dialogOpen: boolean;
}

class DeviceList extends Component<DeviceListProps, DeviceListState> {
    constructor(props: DeviceListProps) {
        super(props);
        this.state = {
            devices: [],
            loading: true,
            selectedDevice: null,
            dialogOpen: false,
        };
    }

    componentDidMount() {
        this.fetchDevices();
    }

    componentDidUpdate(prevProps: DeviceListProps) {
        if (prevProps.basePath !== this.props.basePath) {
            this.fetchDevices();
        }
    }

    async fetchDevices() {
        try {
            const { basePath } = this.props;
            const states = await this.props.socket.getForeignStates(`${basePath}.devices.*`);
            const devices: { id: string; config: any }[] = [];

            for (const [id, state] of Object.entries(states)) {
                if (state && (state as any).val) {
                    try {
                        const config = JSON.parse((state as any).val);
                        devices.push({
                            id,
                            config,
                        });
                    } catch (e) {
                        console.error(`Failed to parse config for ${id}`, e);
                    }
                }
            }

            this.setState({ devices, loading: false });
        } catch (error) {
            console.error("Error fetching devices:", error);
            this.setState({ loading: false });
        }
    }

    handleOpenDialog = (device: any) => {
        this.setState({ selectedDevice: device, dialogOpen: true });
    };

    handleCloseDialog = () => {
        this.setState({ dialogOpen: false, selectedDevice: null });
    };

    render() {
        const { classes } = this.props;
        const { devices, loading, selectedDevice, dialogOpen } = this.state;

        if (loading) {
            return <CircularProgress />;
        }

        return (
            <>
                <TableContainer component={Paper}>
                    <Table className={classes.table} aria-label="device table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Room</TableCell>
                                <TableCell>Manufacturer</TableCell>
                                <TableCell>Model</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {devices.map((device) => (
                                <TableRow key={device.id}>
                                    <TableCell component="th" scope="row">
                                        {device.config.name}
                                    </TableCell>
                                    <TableCell>{device.config.type}</TableCell>
                                    <TableCell>{device.config.room}</TableCell>
                                    <TableCell>{device.config.manufacturer}</TableCell>
                                    <TableCell>{device.config.model}</TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            color="primary"
                                            onClick={() => this.handleOpenDialog(device)}
                                        >
                                            <VisibilityIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Dialog
                    open={dialogOpen}
                    onClose={this.handleCloseDialog}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>Device Configuration</DialogTitle>
                    <DialogContent>
                        {selectedDevice && (
                            <div>
                                <Typography variant="h6">{selectedDevice.config.name}</Typography>
                                <Typography variant="subtitle1" color="textSecondary">
                                    ID: {selectedDevice.id}
                                </Typography>
                                <pre className={classes.jsonPre}>
                                    {JSON.stringify(selectedDevice.config, null, 2)}
                                </pre>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </>
        );
    }
}

export default withStyles(styles)(DeviceList);
